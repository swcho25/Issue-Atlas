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
