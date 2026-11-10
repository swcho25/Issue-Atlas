package com.c108.issueatlas.card.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 카드 목록 ②와 근거 4종 상태. 여기 쿼리는 모두 읽기만 한다 — 근거 행은 질문 실행만 만든다. */
@Repository
public class CardRepository {
    private final JdbcClient jdbc;

    public CardRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean placeExists(String placeId) {
        return jdbc.sql("SELECT EXISTS(SELECT 1 FROM place WHERE place_id = ?)")
                .param(placeId)
                .query(Boolean.class)
                .single();
    }

    /**
     * 공개 카드마다 종류 4줄과 등록된 확보 상태(card_evidence_status, 정확히 같은 지역 · 기간 · 카드 판). 등록이 없으면 not_collected.
     * 지난 실행 결과는 읽지 않는다 — 실행 결과를 다시 읽으면 지난 실행이 다음 실행 입력이 된다.
     */
    public List<CardEvidenceRow> findCards(String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        """
                SELECT c.card_id, c.name, c.domain, c.parent_question, c.card_version,
                       c.taxonomy_version, k.kind, coalesce(s.status, 'not_collected') AS status,
                       coalesce(s.review_pending_count, 0) AS review_pending_count
                FROM card c
                CROSS JOIN (VALUES ('statistics', 1), ('documents', 2),
                            ('existing_responses', 3), ('denominators', 4)) k(kind, position)
                LEFT JOIN card_evidence_status s ON s.card_id = c.card_id
                    AND s.card_version = c.card_version AND s.place_id = :place AND s.kind = k.kind
                    AND s.period_start = :start AND s.period_end = :end
                WHERE c.status IN ('legacy', 'card')
                ORDER BY c.card_id, k.position
                """)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(CardEvidenceRow.class)
                .list();
    }

    /** 카드 한 판의 승인본(JSON). legacy 카드에는 없다. */
    public Optional<String> approvedSpec(String cardId, int version) {
        return jdbc.sql("SELECT spec::text FROM card_version WHERE card_id = ? AND version = ?")
                .params(cardId, version)
                .query(String.class)
                .optional();
    }

    /**
     * 지표의 질문 기간 월 관측으로 정한 필수 근거(통계) 상태: available 한 달이 있으면 available, 없고 미공표 달이 있으면 not_published,
     * 관측 행이 없으면 not_collected.
     */
    public String statisticsStatus(
            String indicatorId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        """
                SELECT CASE WHEN bool_or(o.status = 'available') THEN 'available'
                            WHEN bool_or(o.status = 'not_published') THEN 'not_published'
                            ELSE 'not_collected' END
                FROM observation o
                WHERE o.what_type = 'indicator' AND o.when_unit = 'M' AND o.what_id = :indicator
                  AND o.place_id = :place
                  AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                  AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                """)
                .param("indicator", indicatorId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(String.class)
                .single();
    }

    /**
     * 맞는 기존 대응 후보 수. linked = 질문 실행이 근거로 이을 후보(출처 등급이 있거나 근거 행이 이미 있음), pending = 등급이 없어 보류로만 세는
     * 후보.
     */
    public ResponseCount responseCount(
            String cardId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        "SELECT count(*) FILTER (WHERE linked) AS linked,"
                                + " count(*) FILTER (WHERE NOT linked) AS pending FROM ("
                                + " SELECT EXISTS (SELECT 1 FROM source s WHERE s.source_id = r.origin"
                                + " AND s.reliability_grade IS NOT NULL)"
                                + " OR EXISTS (SELECT 1 FROM evidence e"
                                + " WHERE e.evidence_id = 'ev_' || substr(r.response_id, 6)) AS linked"
                                + " FROM ("
                                + EvidenceMatchSql.RESPONSES
                                + ") r) m")
                .param("card", cardId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(ResponseCount.class)
                .single();
    }

    /** 카드 문서 명세 · 키워드에 맞는 보도자료 수(질문 실행이 문서 근거로 이을 글). */
    public int pressCount(
            List<String> specs,
            List<String> keywords,
            String placeId,
            LocalDate start,
            LocalDate end) {
        if (specs.isEmpty() || keywords.isEmpty()) {
            return 0;
        }
        return jdbc.sql("SELECT count(*) FROM (" + EvidenceMatchSql.PRESS + ") matched")
                .param("keywords", keywords)
                .param("specs", specs)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(Integer.class)
                .single();
    }

    /**
     * 질문 실행이 이 분모 지표를 근거로 이을 수 있는가: 관측 행이 있고, 명세의 출처 등급이 있거나 같은 근거 행({@code ev_den_<md5>})이 이미 있다.
     */
    public boolean denominatorLinked(
            String specId, String indicatorId, String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        "SELECT "
                                + EvidenceMatchSql.DENOMINATOR_OBSERVED
                                + """
                 AND (EXISTS (SELECT 1 FROM source_spec sp JOIN source s USING (source_id)
                             WHERE sp.spec_id = :spec AND s.reliability_grade IS NOT NULL)
                      OR EXISTS (SELECT 1 FROM evidence
                                 WHERE evidence_id = 'ev_den_' || md5(:key)))
                """)
                .param("indicator", indicatorId)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .param("spec", specId)
                .param("key", String.join("|", specId, indicatorId, placeId, start + "", end + ""))
                .query(Boolean.class)
                .single();
    }

    public record CardEvidenceRow(
            String cardId,
            String name,
            String domain,
            String parentQuestion,
            int cardVersion,
            String taxonomyVersion,
            String kind,
            String status,
            int reviewPendingCount) {}

    public record ResponseCount(int linked, int pending) {}
}
