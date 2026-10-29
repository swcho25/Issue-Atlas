package com.c108.issueatlas.job.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 수집기가 남긴 job_run 을 읽기만 한다. 건수 · 실패 코드는 stats 에서 꺼내고 나머지는 그대로 둔다. */
@Repository
public class JobRepository {
    private static final String SELECT =
            """
            SELECT j.job_run_id, s.source_id, s.name AS source_name, j.spec_id, ss.method,
                   j.collector_version, coalesce(j.status, 'running') AS status,
                   j.started_at, j.finished_at,
                   CASE WHEN jsonb_typeof(j.stats -> 'received') = 'number' THEN (j.stats ->> 'received')::bigint END AS received,
                   CASE WHEN jsonb_typeof(j.stats -> 'inserted') = 'number' THEN (j.stats ->> 'inserted')::bigint END AS inserted,
                   CASE WHEN jsonb_typeof(j.stats -> 'duplicates') = 'number' THEN (j.stats ->> 'duplicates')::bigint END AS duplicates,
                   j.stats ->> 'error_code' AS error_code, j.stats::text AS details
            FROM job_run j
            JOIN source_spec ss USING (spec_id)
            JOIN source s ON s.source_id = ss.source_id
            """;
    // 필터가 null 이면 걸지 않는다
    private static final String FILTER =
            """
            WHERE (CAST(:status AS text) IS NULL OR coalesce(j.status, 'running') = :status)
              AND (CAST(:source AS text) IS NULL OR s.source_id = :source)
              AND (CAST(:spec AS text) IS NULL OR j.spec_id = :spec)
            """;

    private final JdbcClient jdbc;

    public JobRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<JobRow> find(String status, String sourceId, String specId, int offset, int limit) {
        return jdbc.sql(
                        SELECT
                                + FILTER
                                + "ORDER BY j.started_at DESC, j.job_run_id LIMIT :limit OFFSET :offset")
                .param("status", status)
                .param("source", sourceId)
                .param("spec", specId)
                .param("limit", limit)
                .param("offset", offset)
                .query(JobRow.class)
                .list();
    }

    public long count(String status, String sourceId, String specId) {
        return jdbc.sql(
                        "SELECT count(*) FROM job_run j JOIN source_spec ss USING (spec_id)"
                                + " JOIN source s ON s.source_id = ss.source_id "
                                + FILTER)
                .param("status", status)
                .param("source", sourceId)
                .param("spec", specId)
                .query(Long.class)
                .single();
    }

    public Optional<JobRow> findById(String jobRunId) {
        return jdbc.sql(SELECT + "WHERE j.job_run_id = :id")
                .param("id", jobRunId)
                .query(JobRow.class)
                .optional();
    }

    /** details 는 stats JSON 문자열 그대로. */
    public record JobRow(
            String jobRunId,
            String sourceId,
            String sourceName,
            String specId,
            String method,
            String collectorVersion,
            String status,
            OffsetDateTime startedAt,
            OffsetDateTime finishedAt,
            Long received,
            Long inserted,
            Long duplicates,
            String errorCode,
            String details) {}
}
