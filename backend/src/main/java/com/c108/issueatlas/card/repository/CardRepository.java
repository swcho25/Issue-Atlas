package com.c108.issueatlas.card.repository;

import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

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

    /** 등록된 확보 상태(card_evidence_status)만. 질문 실행이 읽는다 — 실행 결과를 다시 읽으면 지난 실행이 다음 실행 입력이 된다. */
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

    /**
     * 카드 목록(②)의 근거 상태: 등록된 확보 상태가 있으면 그것, 없으면 같은 지역 · 카드 · 카드 판 · 기간으로 가장 최근에 돌린 실행의 근거 수요표, 그것도
     * 없으면 not_collected (S15P31C108-264). 옛 카드 판의 실행은 섞지 않는다.
     */
    public List<CardEvidenceRow> findCardsForList(String placeId, LocalDate start, LocalDate end) {
        return jdbc.sql(
                        """
                SELECT c.card_id, c.name, c.domain, c.parent_question, c.card_version,
                       c.taxonomy_version, k.kind,
                       coalesce(s.status, e ->> 'status', 'not_collected') AS status,
                       coalesce(s.review_pending_count,
                                (e ->> 'review_pending_count')::int, 0) AS review_pending_count
                FROM card c
                CROSS JOIN (VALUES ('statistics', 1), ('documents', 2),
                            ('existing_responses', 3), ('denominators', 4)) k(kind, position)
                LEFT JOIN card_evidence_status s ON s.card_id = c.card_id
                    AND s.card_version = c.card_version AND s.place_id = :place AND s.kind = k.kind
                    AND s.period_start = :start AND s.period_end = :end
                LEFT JOIN LATERAL (
                    SELECT ar.result
                    FROM argument_run ar JOIN question q ON q.question_id = ar.question_id
                    WHERE q.place_id = :place AND q.card_id = c.card_id
                      AND ar.card_version = c.card_version
                      AND q.period_start = :start AND q.period_end = :end
                    ORDER BY ar.created_at DESC, ar.run_id DESC
                    LIMIT 1
                ) latest ON true
                LEFT JOIN LATERAL (
                    SELECT row FROM jsonb_array_elements(latest.result -> 'evidence_table') row
                    WHERE row ->> 'kind' = k.kind
                ) r(e) ON true
                WHERE c.status IN ('legacy', 'card')
                ORDER BY c.card_id, k.position
                """)
                .param("place", placeId)
                .param("start", start)
                .param("end", end)
                .query(CardEvidenceRow.class)
                .list();
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
}
