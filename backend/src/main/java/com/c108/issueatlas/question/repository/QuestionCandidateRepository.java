package com.c108.issueatlas.question.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 새 이슈 후보 = card_id 가 없는 질문(V0023). 읽기만 한다. */
@Repository
public class QuestionCandidateRepository {
    private static final String FILTER =
            """
            FROM question q
            JOIN place p ON p.place_id = q.place_id
            LEFT JOIN app_user u ON u.id = q.asked_by
            WHERE q.card_id IS NULL
              AND (CAST(:place AS text) IS NULL OR q.place_id = :place)
            """;

    private final JdbcClient jdbc;

    public QuestionCandidateRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 접수 최신 순, 같으면 question_id 순. askerId 가 null 이면 묻는 사람 없음 */
    public List<CandidateRow> page(String placeId, int page, int size) {
        return jdbc.sql(
                        """
                        SELECT q.question_id, q.place_id, p.name AS place_name,
                               q.period_start, q.period_end, q.raw_text,
                               u.id AS asker_id, u.name AS asker_name, u.email AS asker_email,
                               q.created_at
                        """
                                + FILTER
                                + " ORDER BY q.created_at DESC, q.question_id"
                                + " LIMIT :size OFFSET :offset")
                .param("place", placeId)
                .param("size", size)
                .param("offset", (page - 1L) * size)
                .query(CandidateRow.class)
                .list();
    }

    public long count(String placeId) {
        return jdbc.sql("SELECT count(*) " + FILTER)
                .param("place", placeId)
                .query(Long.class)
                .single();
    }

    public record CandidateRow(
            String questionId,
            String placeId,
            String placeName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String rawText,
            Long askerId,
            String askerName,
            String askerEmail,
            OffsetDateTime createdAt) {}
}
