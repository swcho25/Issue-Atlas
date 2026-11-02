package com.c108.issueatlas.question.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class QuestionRepository {
    // -136 기존 대응 후보 중 이 카드 · 지역 · 기간에 맞는 현재 판. 세출은 회계연도, 온통청년은 사업 기간이 겹치는지 본다.
    // 기간을 모르는 후보와 광역(place_id null) 후보는 고르지 않는다
    private static final String MATCHED =
            """
            SELECT r.* FROM existing_response r
            WHERE r.is_current AND r.card_id = :card AND r.place_id = :place
              AND CASE WHEN r.origin = 'lofin'
                    THEN daterange(make_date(r.fiscal_year, 1, 1), make_date(r.fiscal_year + 1, 1, 1))
                    ELSE daterange(r.period_start, r.period_end) END && daterange(:start, :end)
              AND (r.origin = 'lofin' OR r.period_start IS NOT NULL OR r.period_end IS NOT NULL)
            """;

    private final JdbcClient jdbc;

    public QuestionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> placeName(String placeId) {
        return jdbc.sql("SELECT name FROM place WHERE place_id = ?")
                .param(placeId)
                .query(String.class)
                .optional();
    }

    public Optional<CardRow> card(String cardId) {
        return jdbc.sql(
                        "SELECT card_id, name, card_version, taxonomy_version FROM card"
                                + " WHERE card_id = ?")
                .param(cardId)
                .query(CardRow.class)
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

    public void insertQuestion(
            String questionId,
            String placeId,
            String cardId,
            LocalDate start,
            LocalDate end,
            String rawText) {
        jdbc.sql(
                        "INSERT INTO question (question_id, place_id, card_id, period_start,"
                                + " period_end, raw_text) VALUES (?, ?, ?, ?, ?, ?)")
                .params(questionId, placeId, cardId, start, end, rawText)
                .update();
    }

    public void insertRun(
            String runId,
            String questionId,
            String runStatus,
            Integer cardVersion,
            String formulaVersion,
            String taxonomyVersion,
            String result,
            OffsetDateTime createdAt) {
        jdbc.sql(
                        "INSERT INTO argument_run (run_id, question_id, run_status, card_version,"
                                + " formula_version, taxonomy_version, result, created_at)"
                                + " VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)")
                .params(
                        runId,
                        questionId,
                        runStatus,
                        cardVersion,
                        formulaVersion,
                        taxonomyVersion,
                        result,
                        createdAt)
                .update();
    }

    public void insertSource(String runId, String kind, String evidenceId, String responseId) {
        jdbc.sql(
                        "INSERT INTO argument_run_source (run_id, kind, evidence_id, response_id)"
                                + " VALUES (?, ?, ?, ?)")
                .params(runId, kind, evidenceId, responseId)
                .update();
    }

    public Optional<String> result(String runId) {
        return jdbc.sql("SELECT result::text FROM argument_run WHERE run_id = ?")
                .param(runId)
                .query(String.class)
                .optional();
    }

    public record CardRow(String cardId, String name, int cardVersion, String taxonomyVersion) {}

    public record MatchedResponse(String responseId, String evidenceId) {}

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
