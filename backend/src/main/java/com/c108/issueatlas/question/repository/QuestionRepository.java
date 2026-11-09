package com.c108.issueatlas.question.repository;

import com.c108.issueatlas.card.repository.EvidenceMatchSql;
import com.c108.issueatlas.question.dto.ApprovedCard;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class QuestionRepository {
    // 기존 대응 · 보도자료 고르기 SQL 은 카드 목록 ②와 같이 쓴다(EvidenceMatchSql). 한쪽만 고치면 두 화면 상태가 어긋난다
    private static final String MATCHED = EvidenceMatchSql.RESPONSES;
    private static final String PRESS_MATCHES = EvidenceMatchSql.PRESS;

    // 화면 series(「시공간 표시 개발 명세」 5 · 6절): 질문 지역의 월 단위 통계 관측(observation view, V0025).
    // 측정소 행은 place_id 가 측정소의 시군구라 같이 잡힌다. 이동은 도착 시도 이름 · 대표점을 붙인다
    private static final String SERIES =
            """
            SELECT o.what_id, o.station_id, o.to_place_id, o.unit, o.value, o.status,
                   to_char(o.when_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS period,
                   o.lon, o.lat, st.name AS station_name, tp.name AS to_name,
                   ST_X(tp.geometry::geometry) AS to_lon, ST_Y(tp.geometry::geometry) AS to_lat
            FROM observation o
            LEFT JOIN place st ON st.place_id = o.station_id
            LEFT JOIN place tp ON tp.place_id = o.to_place_id
            WHERE o.what_type = 'indicator' AND o.when_unit = 'M' AND o.what_id IN (:ids)
              AND o.place_id = :place
              AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
              AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
            ORDER BY o.what_id, o.station_id NULLS FIRST, o.to_place_id NULLS FIRST, o.when_start
            """;

    // 근거 기사: 카드 태그가 있고 질문 지역(앞자리가 같은 읍면동 포함) · 기간 안인 기사(명세 6절).
    // 근거 상세에 쓸 값(제목 · 이용 조건 · 원문 위치 · 링크)은 수집 원본(빅카인즈 레코드)에만 있다. 본문은 옮기지 않는다.
    // 기사 근거 ID 는 정제 판마다 하나: ev_news_<md5(obs_key|content_hash)> (보도자료 ev_doc_ 와 같은 규칙)
    private static final String ARTICLE_MATCHES =
            """
            SELECT o.what_id AS id, o.when_start, o.place_id, o.lon, o.lat, o.location_precision, o.summary,
                   e.place_name, p.name AS area_name, ST_X(p.geometry::geometry) AS area_lon,
                   ST_Y(p.geometry::geometry) AS area_lat, n.url, n.title, n.license_type, n.storage_scope,
                   n.published_at, n.collected_at, n.locator,
                   'ev_news_' || md5(n.obs_key || '|' || n.content_hash) AS news_evidence_id
            FROM observation o
            JOIN news_event e ON e.news_id = o.what_id
            LEFT JOIN place p ON p.place_id = o.place_id
            LEFT JOIN LATERAL (
                SELECT r.record -> 'document' ->> 'link' AS url, r.record -> 'document' ->> 'title' AS title,
                       r.record ->> 'license_type' AS license_type, r.storage_scope,
                       (r.record ->> 'published_at')::timestamptz AS published_at,
                       (r.record ->> 'collected_at')::timestamptz AS collected_at,
                       jsonb_strip_nulls(jsonb_build_object('spec_id', r.spec_id, 'locator', r.record -> 'locator',
                           'publisher', r.record -> 'document' ->> 'publisher', 'obs_key', r.obs_key,
                           'content_hash', r.content_hash)) AS locator,
                       r.obs_key, r.content_hash
                FROM normalized_ready r
                WHERE r.source_id = 'bigkinds' AND r.record -> 'locator' ->> 'news_id' = e.news_id
                ORDER BY r.refined_at DESC LIMIT 1
            ) n ON true
            WHERE o.source_table = 'news_event' AND :card = ANY (o.tags) AND starts_with(o.place_id, :place)
              AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
              AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
            """;

    private static final String ARTICLES =
            "SELECT a.id, to_char(a.when_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,"
                    + " a.place_id, a.lon, a.lat, a.location_precision, a.summary, a.place_name,"
                    + " a.area_name, a.area_lon, a.area_lat, a.url, ev.evidence_id, ev.source_grade"
                    + " FROM ("
                    + ARTICLE_MATCHES
                    + ") a LEFT JOIN evidence ev ON ev.evidence_id = a.news_evidence_id"
                    + " ORDER BY a.when_start, a.id";

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public QuestionRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Optional<String> placeName(String placeId) {
        return jdbc.sql("SELECT name FROM place WHERE place_id = ?")
                .param(placeId)
                .query(String.class)
                .optional();
    }

    /** 지역 단위(sido · sigungu · emd · station). 카드 적용 조건 place_level 과 맞춘다. */
    public Optional<String> placeLevel(String placeId) {
        return jdbc.sql("SELECT level FROM place WHERE place_id = ?")
                .param(placeId)
                .query(String.class)
                .optional();
    }

    public Optional<CardRow> card(String cardId) {
        return jdbc.sql(
                        "SELECT card_id, name, card_version, taxonomy_version FROM card"
                                + " WHERE card_id = ? AND status IN ('legacy', 'card')")
                .param(cardId)
                .query(CardRow.class)
                .optional();
    }

    /** 공개 카드 행에서 고른 정확한 판을 읽는다. legacy에는 승인본이 없다. */
    public Optional<ApprovedCard> approvedCard(String cardId, int version) {
        return jdbc.sql("SELECT spec::text FROM card_version WHERE card_id = ? AND version = ?")
                .params(cardId, version)
                .query(
                        (row, index) ->
                                new ApprovedCard(cardId, version, json.readTree(row.getString(1))))
                .optional();
    }

    public String taxonomyVersion() {
        return jdbc.sql("SELECT DISTINCT taxonomy_version FROM card").query(String.class).single();
    }

    /** 맞는 후보를 근거(evidence)로 만든다. 출처 등급이 정해진 출처만 — 등급 없는 근거는 만들지 않는다. 같은 판은 같은 근거 ID 라 다시 넣지 않는다. */
    public void createResponseEvidence(
            String cardId, String placeId, LocalDate start, LocalDate end) {
        jdbc.sql(
                        "WITH r AS ("
                                + MATCHED
                                + """
                ), v AS (
                    SELECT r.*, coalesce(w.collected_at, x.collected_at) AS collected_at,
                           coalesce(x.license_type, s.license_type) AS license_type,
                           coalesce(x.storage_scope, s.storage_scope) AS storage_scope,
                           s.reliability_grade
                    FROM r JOIN source s ON s.source_id = r.origin
                    LEFT JOIN raw_record w ON w.content_hash = r.raw_content_hash
                    LEFT JOIN local_expenditure x USING (expenditure_id)
                    WHERE s.reliability_grade IS NOT NULL
                )
                INSERT INTO evidence (evidence_id, kind, title, source_id, source_grade,
                    license_type, storage_scope, period_start, period_end, collected_at, locator)
                SELECT 'ev_' || substr(response_id, 6), 'existing_responses', name, origin,
                       reliability_grade, license_type, storage_scope,
                       CASE WHEN period_end IS NOT NULL THEN period_start END,
                       CASE WHEN period_start IS NOT NULL THEN period_end END,
                       collected_at,
                       jsonb_strip_nulls(jsonb_build_object('response_id', response_id,
                           'origin_ref', origin_ref, 'raw_content_hash', raw_content_hash,
                           'expenditure_id', expenditure_id, 'fiscal_year', fiscal_year,
                           'department', department, 'rule_version', rule_version))
                FROM v
                ON CONFLICT (evidence_id) DO NOTHING
                """)
                .param("card", cardId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .update();
    }

    /** 맞는 후보마다 근거 ID. 출처 등급이 없어 근거로 못 만든 후보는 null. */
    public List<MatchedResponse> matchedResponses(
            String cardId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        "SELECT r.response_id, e.evidence_id FROM ("
                                + MATCHED
                                + ") r LEFT JOIN evidence e"
                                + " ON e.evidence_id = 'ev_' || substr(r.response_id, 6)"
                                + " ORDER BY r.response_id")
                .param("card", cardId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(MatchedResponse.class)
                .list();
    }

    /**
     * 통계 근거 한 건(지역 · 기간 · 지표의 월 관측 묶음)을 만들고 ID 를 준다. 같은 묶음은 같은 ID 라 다시 실행해도 한 행. 출처 등급이 없는 출처면 만들지
     * 않는다(기존 대응 근거와 같은 규칙).
     */
    public Optional<String> statisticsEvidence(
            String specId,
            String indicatorId,
            String label,
            String placeId,
            LocalDate start,
            LocalDate end) {
        return observationEvidence(
                "statistics", "ev_stat_", specId, indicatorId, label, placeId, start, end);
    }

    /**
     * 분모 근거 한 건(지역 · 기간 · 분모 지표의 관측 묶음, ID {@code ev_den_<md5>}). 질문 기간에 available 관측 행이 있을 때만 만든다
     * — 없으면 분모 칸은 not_collected. 이름은 승인본 지표 사본(label), 없으면 지표 사전(indicator), 그것도 없으면 지표 ID.
     */
    public Optional<String> denominatorEvidence(
            String specId,
            String indicatorId,
            String label,
            String placeId,
            LocalDate start,
            LocalDate end) {
        boolean observed =
                jdbc.sql("SELECT " + EvidenceMatchSql.DENOMINATOR_OBSERVED)
                        .param("indicator", indicatorId)
                        .param("place", placeId)
                        .param("start", start)
                        .param("end", end)
                        .query(Boolean.class)
                        .single();
        if (!observed) {
            return Optional.empty();
        }
        String name =
                label != null && !label.isBlank()
                        ? label
                        : jdbc.sql(
                                        "SELECT coalesce((SELECT definition ->> 'label' FROM indicator"
                                                + " WHERE indicator_id = ?), ?)")
                                .params(indicatorId, indicatorId)
                                .query(String.class)
                                .single();
        return observationEvidence(
                "denominators", "ev_den_", specId, indicatorId, name, placeId, start, end);
    }

    private Optional<String> observationEvidence(
            String kind,
            String prefix,
            String specId,
            String indicatorId,
            String label,
            String placeId,
            LocalDate start,
            LocalDate end) {
        String id =
                prefix
                        + jdbc.sql("SELECT md5(?)")
                                .param(
                                        String.join(
                                                "|",
                                                specId,
                                                indicatorId,
                                                placeId,
                                                start + "",
                                                end + ""))
                                .query(String.class)
                                .single();
        jdbc.sql(
                        """
                INSERT INTO evidence (evidence_id, kind, title, source_id, source_grade, license_type,
                    storage_scope, observed_at, period_start, period_end, collected_at, locator)
                SELECT :id, :kind, s.name || ' · ' || :label, s.source_id, s.reliability_grade,
                       s.license_type, s.storage_scope,
                       -- 시점 = 마지막 관측 기간의 마지막 날(한국 0시). when_end 는 끝 경계(다음 달 1일 0시,
                       -- 포함 안 함)라 하루를 뺀다. 2025-12 월 값 → 2025-12-31 (S15P31C108-272)
                       (SELECT max(greatest(o.when_start, o.when_end - interval '1 day'))
                        FROM observation o
                        WHERE o.what_id = :indicator AND o.place_id = :place AND o.status = 'available'
                          AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                          AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'),
                       :start, :end, now(),
                       jsonb_build_object('spec_id', :spec, 'indicator_id', :indicator, 'place_id', :place)
                FROM source_spec sp JOIN source s USING (source_id)
                WHERE sp.spec_id = :spec AND s.reliability_grade IS NOT NULL
                ON CONFLICT (evidence_id) DO NOTHING
                """)
                .param("id", id)
                .param("kind", kind)
                .param("label", label)
                .param("indicator", indicatorId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .param("spec", specId)
                .update();
        return jdbc.sql("SELECT evidence_id FROM evidence WHERE evidence_id = ?")
                .param(id)
                .query(String.class)
                .optional();
    }

    /**
     * 카드 문서 명세의 보도자료를 문서 근거(ID {@code ev_doc_<md5(obs_key|content_hash)>})로 만들고 ID 를 등록일 순으로 준다. 같은
     * 글 같은 판은 같은 ID 라 다시 실행해도 한 행. 제목 · 등록일 · 원문 링크만 두고 본문은 두지 않는다(보도자료 계약 v0.3 「왜 목록만인가」).
     */
    public List<String> pressEvidence(
            List<String> specs,
            List<String> keywords,
            String placeId,
            LocalDate start,
            LocalDate end) {
        if (specs.isEmpty() || keywords.isEmpty()) {
            return List.of();
        }
        jdbc.sql(
                        "WITH matched AS ("
                                + PRESS_MATCHES
                                + ") INSERT INTO evidence (evidence_id, kind, title, source_id,"
                                + " source_grade, license_type, storage_scope, observed_at,"
                                + " published_at, collected_at, locator, url)"
                                + " SELECT evidence_id, 'documents', title, source_id,"
                                + " reliability_grade, license_type, storage_scope, published_at,"
                                + " published_at, coalesce(collected_at, now()), locator, url"
                                + " FROM matched ON CONFLICT (evidence_id) DO NOTHING")
                .param("keywords", keywords)
                .param("specs", specs)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .update();
        return jdbc.sql(
                        "SELECT evidence_id FROM ("
                                + PRESS_MATCHES
                                + ") matched ORDER BY published_at, evidence_id")
                .param("keywords", keywords)
                .param("specs", specs)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(String.class)
                .list();
    }

    public List<EvidenceRef> evidence(List<String> evidenceIds) {
        if (evidenceIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(
                        """
                SELECT e.evidence_id, e.title, s.name AS source_name, e.source_id, e.source_grade,
                       e.period_start, e.period_end, e.storage_scope, e.observed_at
                FROM evidence e JOIN source s USING (source_id)
                WHERE e.evidence_id IN (:ids) ORDER BY e.evidence_id
                """)
                .param("ids", evidenceIds)
                .query(EvidenceRef.class)
                .list();
    }

    /** 로그인한 사람의 사용자 ID(질문의 묻는 사람). 없거나 쉬는 계정이면 비어 있다 */
    public Optional<Long> userId(String email) {
        return jdbc.sql("SELECT id FROM app_user WHERE email = ? AND is_active")
                .param(email)
                .query(Long.class)
                .optional();
    }

    /** askedBy 는 로그인 없이 물었으면 null */
    public void insertQuestion(
            String questionId,
            String placeId,
            String cardId,
            LocalDate start,
            LocalDate end,
            String rawText,
            Long askedBy) {
        jdbc.sql(
                        "INSERT INTO question (question_id, place_id, card_id, period_start,"
                                + " period_end, raw_text, asked_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .params(questionId, placeId, cardId, start, end, rawText, askedBy)
                .update();
    }

    /** 그 사람이 물은 질문 하나(다시 실행). 남의 질문이면 비어 있다 */
    public Optional<StoredQuestion> ownQuestion(String questionId, long userId) {
        return jdbc.sql(
                        "SELECT question_id, place_id, card_id, period_start, period_end, raw_text"
                                + " FROM question WHERE question_id = ? AND asked_by = ?")
                .params(questionId, userId)
                .query(StoredQuestion.class)
                .optional();
    }

    /** 그 사람이 물은 질문. 마지막 실행이 새로운 것부터 */
    public List<MyQuestionRow> myQuestions(long userId) {
        return jdbc.sql(
                        """
                SELECT q.question_id, q.place_id, p.name AS place_name, q.card_id, c.name AS card_name,
                       q.period_start, q.period_end, q.raw_text, q.created_at
                FROM question q
                JOIN place p ON p.place_id = q.place_id
                LEFT JOIN card c ON c.card_id = q.card_id
                WHERE q.asked_by = ?
                ORDER BY (SELECT max(r.created_at) FROM argument_run r
                          WHERE r.question_id = q.question_id) DESC NULLS LAST,
                         q.created_at DESC, q.question_id
                """)
                .param(userId)
                .query(MyQuestionRow.class)
                .list();
    }

    /** 그 사람 질문들의 실행(회차). 새것부터, 판단은 저장된 결과의 claim 그대로 */
    public List<MyRunRow> myRuns(long userId) {
        return jdbc.sql(
                        """
                SELECT r.question_id, r.run_id, r.run_status, r.created_at,
                       r.result -> 'claim' ->> 'value' AS claim, r.result -> 'claim' ->> 'text' AS claim_text
                FROM argument_run r JOIN question q ON q.question_id = r.question_id
                WHERE q.asked_by = ?
                ORDER BY r.created_at DESC, r.run_id DESC
                """)
                .param(userId)
                .query(MyRunRow.class)
                .list();
    }

    /** 같은 지역 × 카드 × 기간의 가장 최근 실행(재실행 로그의 앞 실행). 카드 없는 질문은 card_id 가 null 끼리 같다. */
    public Optional<PreviousRun> previousRun(
            String placeId, String cardId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        """
                        SELECT r.run_id, r.filled_cells, r.duration_ms
                        FROM argument_run r JOIN question q ON q.question_id = r.question_id
                        WHERE q.place_id = :place AND q.card_id IS NOT DISTINCT FROM :card
                          AND q.period_start = :start AND q.period_end = :end
                        ORDER BY r.created_at DESC, r.run_id DESC
                        LIMIT 1
                        """)
                .param("place", placeId)
                .param("card", cardId)
                .param("start", start)
                .param("end", end)
                .query(PreviousRun.class)
                .optional();
    }

    public void insertRun(
            String runId,
            String questionId,
            String runStatus,
            Integer cardVersion,
            String formulaVersion,
            String taxonomyVersion,
            String result,
            OffsetDateTime createdAt,
            String previousRunId,
            int filledCells,
            int durationMs) {
        jdbc.sql(
                        "INSERT INTO argument_run (run_id, question_id, run_status, card_version,"
                                + " formula_version, taxonomy_version, result, created_at,"
                                + " previous_run_id, filled_cells, duration_ms)"
                                + " VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)")
                .params(
                        runId,
                        questionId,
                        runStatus,
                        cardVersion,
                        formulaVersion,
                        taxonomyVersion,
                        result,
                        createdAt,
                        previousRunId,
                        filledCells,
                        durationMs)
                .update();
    }

    /** 실행 한 건의 문장화 기록(V0046). problems · citations 는 JSON 문자열. */
    public void insertPhrasing(String runId, PhrasingRow row) {
        jdbc.sql(
                        "INSERT INTO argument_phrasing (run_id, status, reason_code, problems,"
                                + " citations, model, prompt_version, duration_ms)"
                                + " VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)")
                .params(
                        runId,
                        row.status(),
                        row.reasonCode(),
                        row.problems(),
                        row.citations(),
                        row.model(),
                        row.promptVersion(),
                        row.durationMs())
                .update();
    }

    public void insertSource(String runId, String kind, String evidenceId, String responseId) {
        jdbc.sql(
                        "INSERT INTO argument_run_source (run_id, kind, evidence_id, response_id)"
                                + " VALUES (?, ?, ?, ?)")
                .params(runId, kind, evidenceId, responseId)
                .update();
    }

    public List<SeriesRow> seriesRows(
            List<String> indicatorIds, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(SERIES)
                .param("ids", indicatorIds)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(SeriesRow.class)
                .list();
    }

    /** 판정용 원본 관측. 그림용 월 series와 달리 연 관측도 포함한다. */
    public List<ObservationRow> observationRows(
            String indicatorId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        """
                SELECT o.station_id, o.when_unit,
                       to_char(o.when_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS period,
                       o.value, o.status
                FROM observation o
                WHERE o.what_type = 'indicator' AND o.what_id = :indicator AND o.place_id = :place
                  AND o.when_unit IN ('M', 'Y')
                  AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                  AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                ORDER BY o.station_id NULLS FIRST, o.when_start
                """)
                .param("indicator", indicatorId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(ObservationRow.class)
                .list();
    }

    /**
     * 근거 기사마다 문서 근거 행(ID {@code ev_news_<md5(obs_key|content_hash)>})을 만든다. 같은 기사 같은 판은 같은 ID 라 다시
     * 실행해도 한 행. 제목 · 공표일 · 원문 링크 · 원문 위치만 두고 본문 · display 는 없다. 출처 등급이 없으면 만들지 않는다(다른 근거와 같은 규칙).
     * 기사는 data.documents 에 넣지 않고 articles[] 에서 이 ID 로만 잇는다(C2 README).
     */
    public void createArticleEvidence(
            String cardId, String placeId, LocalDate start, LocalDate end) {
        jdbc.sql(
                        "WITH a AS ("
                                + ARTICLE_MATCHES
                                + """
                ) INSERT INTO evidence (evidence_id, kind, title, source_id, source_grade, license_type,
                    storage_scope, observed_at, published_at, collected_at, location_precision, locator, url)
                SELECT DISTINCT ON (a.news_evidence_id) a.news_evidence_id, 'documents', a.title,
                       s.source_id, s.reliability_grade, coalesce(a.license_type, s.license_type),
                       coalesce(a.storage_scope, s.storage_scope), a.when_start, a.published_at,
                       coalesce(a.collected_at, now()),
                       CASE WHEN a.location_precision IN ('exact', 'address', 'admin_centroid')
                            THEN a.location_precision ELSE 'none' END,
                       a.locator, a.url
                FROM a JOIN source s ON s.source_id = 'bigkinds'
                WHERE s.reliability_grade IS NOT NULL AND a.news_evidence_id IS NOT NULL
                  AND a.title IS NOT NULL
                ON CONFLICT (evidence_id) DO NOTHING
                """)
                .param("card", cardId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .update();
    }

    public List<ArticleRow> articles(
            String cardId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(ARTICLES)
                .param("card", cardId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(ArticleRow.class)
                .list();
    }

    /** 지역 대표점 [경도, 위도]. 좌표가 없으면 null 두 개. */
    public List<Double> point(String placeId) {
        return jdbc.sql(
                        "SELECT ST_X(geometry::geometry) AS lon, ST_Y(geometry::geometry) AS lat"
                                + " FROM place WHERE place_id = ?")
                .param(placeId)
                .query(
                        (rs, n) ->
                                Arrays.asList(
                                        rs.getObject(1, Double.class),
                                        rs.getObject(2, Double.class)))
                .optional()
                .orElse(Arrays.asList(null, null));
    }

    public Optional<String> result(String runId) {
        return jdbc.sql("SELECT result::text FROM argument_run WHERE run_id = ?")
                .param(runId)
                .query(String.class)
                .optional();
    }

    public record CardRow(String cardId, String name, int cardVersion, String taxonomyVersion) {}

    public record StoredQuestion(
            String questionId,
            String placeId,
            String cardId,
            LocalDate periodStart,
            LocalDate periodEnd,
            String rawText) {}

    public record MyQuestionRow(
            String questionId,
            String placeId,
            String placeName,
            String cardId,
            String cardName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String rawText,
            OffsetDateTime createdAt) {}

    public record MyRunRow(
            String questionId,
            String runId,
            String runStatus,
            OffsetDateTime createdAt,
            String claim,
            String claimText) {}

    public record ObservationRow(
            String stationId, String whenUnit, String period, BigDecimal value, String status) {}

    public record MatchedResponse(String responseId, String evidenceId) {}

    /** argument_phrasing 한 행. reasonCode 는 done 이면 null */
    public record PhrasingRow(
            String status,
            String reasonCode,
            String problems,
            String citations,
            String model,
            String promptVersion,
            int durationMs) {}

    /** 재실행 로그의 앞 실행. 칸이 생기기 전(V0033) 실행은 지표가 null */
    public record PreviousRun(String runId, Integer filledCells, Integer durationMs) {}

    public record SeriesRow(
            String whatId,
            String stationId,
            String toPlaceId,
            String unit,
            BigDecimal value,
            String status,
            String period,
            Double lon,
            Double lat,
            String stationName,
            String toName,
            Double toLon,
            Double toLat) {}

    public record ArticleRow(
            String id,
            String date,
            String placeId,
            Double lon,
            Double lat,
            String locationPrecision,
            String summary,
            String placeName,
            String areaName,
            Double areaLon,
            Double areaLat,
            String url,
            String evidenceId,
            String sourceGrade) {}

    public record EvidenceRef(
            String evidenceId,
            String title,
            String sourceName,
            String sourceId,
            String sourceGrade,
            LocalDate periodStart,
            LocalDate periodEnd,
            String storageScope,
            OffsetDateTime observedAt) {}
}
