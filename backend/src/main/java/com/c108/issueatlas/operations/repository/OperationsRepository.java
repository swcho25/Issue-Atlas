package com.c108.issueatlas.operations.repository;

import com.c108.issueatlas.operations.dto.OperationsDto.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class OperationsRepository {
    private static final String RUN_FROM =
            """
        FROM argument_run r JOIN question q ON q.question_id=r.question_id
        JOIN place p ON p.place_id=q.place_id LEFT JOIN card c ON c.card_id=q.card_id
        """;
    private static final String RUN_SELECT =
            """
        SELECT r.run_id,r.question_id,q.place_id,p.name AS place_name,q.card_id,c.name AS card_name,
            q.period_start,q.period_end,r.run_status,r.card_version,r.formula_version,r.taxonomy_version,
            r.previous_run_id,r.filled_cells,r.edit_count,r.created_at
        """;
    private static final String RUN_FILTER =
            """
        WHERE (CAST(:place AS text) IS NULL OR q.place_id=:place)
          AND (CAST(:card AS text) IS NULL OR q.card_id=:card)
          AND (CAST(:start AS date) IS NULL OR q.period_start=:start)
          AND (CAST(:end AS date) IS NULL OR q.period_end=:end)
        """;
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public OperationsRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Queues queues() {
        // 검수 API와 동일하게 카드 승인으로 넘긴 요청의 실제 승인 상태를 읽는다.
        var reviews =
                counts(
                        """
            SELECT CASE WHEN r.status='approval_pending' THEN
                CASE a.status WHEN 'approved' THEN 'resolved' WHEN 'rejected' THEN 'rejected'
                    WHEN 'on_hold' THEN 'on_hold' ELSE 'approval_pending' END
                ELSE r.status END AS status
            FROM review_request r LEFT JOIN card_approval_request a ON a.request_id=r.approval_request_id
            """,
                        List.of("pending", "on_hold", "resolved", "rejected", "approval_pending"),
                        null);
        return new Queues(
                reviews,
                counts(
                        "SELECT status FROM card_approval_request",
                        List.of("pending", "on_hold", "approved", "rejected"),
                        null),
                counts(
                        "SELECT status FROM csv_import_request",
                        List.of(
                                "validation_failed",
                                "no_changes",
                                "pending",
                                "completed",
                                "failed"),
                        null));
    }

    public Activity activity(Period period) {
        return new Activity(
                counts(
                        "SELECT action AS status FROM review_change WHERE created_at>=:from AND created_at<:to",
                        List.of("confirm", "correct", "hold", "reject"),
                        period),
                counts(
                        "SELECT decision AS status FROM card_approval_decision WHERE created_at>=:from AND created_at<:to",
                        List.of("approve", "reject", "hold"),
                        period),
                counts(
                        "SELECT status FROM csv_import_result WHERE created_at>=:from AND created_at<:to",
                        List.of("completed", "failed"),
                        period),
                counts(
                        "SELECT coalesce(status,'running') AS status FROM job_run WHERE started_at>=:from AND started_at<:to",
                        List.of("ok", "failed", "aborted", "running"),
                        period));
    }

    private Map<String, Long> counts(String source, List<String> statuses, Period period) {
        var query =
                jdbc.sql(
                        "SELECT status,count(*) AS total FROM ("
                                + source
                                + ") states GROUP BY status");
        if (period != null) query = query.param("from", period.from()).param("to", period.to());
        Map<String, Long> result = new LinkedHashMap<>();
        statuses.forEach(s -> result.put(s, 0L));
        query.query((r, n) -> Map.entry(r.getString("status"), r.getLong("total")))
                .list()
                .forEach(e -> result.put(e.getKey(), e.getValue()));
        return result;
    }

    public Inventory inventory() {
        return jdbc.sql(
                        """
            SELECT (SELECT count(*) FROM raw_record) AS raw_records,
                (SELECT count(*) FROM normalized_record) AS normalized_records,
                (SELECT count(*) FROM normalized_ready) AS ready_records
            """)
                .query(Inventory.class)
                .single();
    }

    public List<SourceStatus> sources() {
        return jdbc.sql(
                        """
            SELECT s.source_id,s.name,s.storage_scope,s.reliability_grade,s.robots_status,
                (SELECT count(*) FROM source_spec ss WHERE ss.source_id=s.source_id) AS spec_count,
                (SELECT count(*) FROM source_spec ss WHERE ss.source_id=s.source_id AND NOT EXISTS
                    (SELECT FROM job_run j WHERE j.spec_id=ss.spec_id)) AS never_run_spec_count,
                CASE WHEN last.job_run_id IS NULL THEN 'unknown' ELSE coalesce(last.status,'running') END AS latest_job_status,
                last.started_at AS last_started_at,
                (SELECT max(j.finished_at) FROM job_run j JOIN source_spec ss USING(spec_id)
                    WHERE ss.source_id=s.source_id AND j.status='ok') AS last_successful_at
            FROM source s LEFT JOIN LATERAL (
                SELECT j.job_run_id,j.status,j.started_at FROM job_run j JOIN source_spec ss USING(spec_id)
                WHERE ss.source_id=s.source_id ORDER BY j.started_at DESC,j.job_run_id DESC LIMIT 1
            ) last ON true ORDER BY s.source_id
            """)
                .query(SourceStatus.class)
                .list();
    }

    public Page runs(RunFilter filter, int page, int size) {
        var items =
                filtered(
                                RUN_SELECT
                                        + RUN_FROM
                                        + RUN_FILTER
                                        + " ORDER BY r.created_at DESC,r.run_id DESC LIMIT :size OFFSET :offset",
                                filter)
                        .param("size", size)
                        .param("offset", (page - 1L) * size)
                        .query(Run.class)
                        .list();
        long total =
                filtered("SELECT count(*) " + RUN_FROM + RUN_FILTER, filter)
                        .query(Long.class)
                        .single();
        return new Page(items, total, page, size);
    }

    private JdbcClient.StatementSpec filtered(String sql, RunFilter f) {
        return jdbc.sql(sql)
                .param("place", f.placeId())
                .param("card", f.cardId())
                .param("start", f.periodStart())
                .param("end", f.periodEnd());
    }

    public Optional<Run> run(String id) {
        return jdbc.sql(RUN_SELECT + RUN_FROM + " WHERE r.run_id=?")
                .param(id)
                .query(Run.class)
                .optional();
    }

    public JsonNode result(String id) {
        return json.readTree(
                jdbc.sql("SELECT result::text FROM argument_run WHERE run_id=?")
                        .param(id)
                        .query(String.class)
                        .single());
    }
}
