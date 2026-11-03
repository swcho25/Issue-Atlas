package com.c108.issueatlas.review.repository;

import com.c108.issueatlas.review.dto.ReviewDto.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class ReviewRepository {
    // 요청을 승인 흐름으로 넘긴 뒤에는 별도 복사 상태를 갱신하지 않고 실제 승인 상태를 읽는다.
    private static final String STATUS =
            """
        CASE WHEN r.status='approval_pending' THEN
          CASE a.status WHEN 'approved' THEN 'resolved' WHEN 'rejected' THEN 'rejected'
            WHEN 'on_hold' THEN 'on_hold' ELSE 'approval_pending' END
        ELSE r.status END
        """;
    private static final String REQUESTS =
            " FROM review_request r LEFT JOIN card_approval_request a ON a.request_id=r.approval_request_id ";
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public ReviewRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Optional<Long> actor(String email, boolean admin) {
        return jdbc.sql(
                        "SELECT id FROM app_user WHERE email=? AND is_active"
                                + (admin ? " AND role='ADMIN'" : "")
                                + " FOR SHARE")
                .param(email)
                .query(Long.class)
                .optional();
    }

    public boolean exists(String table, String key, String id) {
        // table/key는 서비스의 고정 목록만 전달한다. HTTP 값은 바인딩한다.
        return jdbc.sql("SELECT EXISTS(SELECT FROM " + table + " WHERE " + key + "=?)")
                .param(id)
                .query(Boolean.class)
                .single();
    }

    public Optional<JsonNode> target(String type, String id, boolean lock) {
        String table =
                switch (type) {
                    case "news_event", "normalized_record", "press_release", "source", "card" ->
                            type;
                    default -> throw new IllegalArgumentException();
                };
        String key =
                switch (type) {
                    case "news_event" -> "news_id";
                    case "normalized_record" -> "id";
                    case "press_release" -> "press_id";
                    case "source" -> "source_id";
                    default -> "card_id";
                };
        if (lock
                && jdbc.sql(
                                "SELECT "
                                        + key
                                        + "::text FROM "
                                        + table
                                        + " WHERE "
                                        + key
                                        + (type.equals("normalized_record")
                                                ? "=CAST(? AS bigint)"
                                                : "=?")
                                        + " FOR UPDATE")
                        .param(id)
                        .query(String.class)
                        .optional()
                        .isEmpty()) return Optional.empty();
        String sql =
                switch (type) {
                    case "card" ->
                            "SELECT jsonb_build_object('draft_revision',draft_revision,'draft_spec',draft_spec,'current_version',current_version)::text FROM card WHERE card_id=?";
                    case "source" ->
                            "SELECT jsonb_build_object('source_id',source_id,'name',name,'org',org,'license_type',license_type,'storage_scope',storage_scope,'reliability_grade',reliability_grade,'robots_status',robots_status)::text FROM source WHERE source_id=?";
                    case "normalized_record" ->
                            """
                SELECT jsonb_build_object('id',id,'content_hash',content_hash,'source_id',source_id,
                  'spec_id',spec_id,'indicator_id',indicator_id,'place_code_system',place_code_system,
                  'place_code_raw',place_code_raw,'value',value,'unit',unit,'validation_status',validation_status,
                  'refined_at',refined_at)::text FROM normalized_record WHERE id=CAST(? AS bigint)
                """;
                    case "press_release" ->
                            """
                SELECT jsonb_build_object('press_id',press_id,'site',site,'org',org,'place_code_raw',place_code_raw,
                  'category',category,'department',department,'title',title,'published_on',published_on,
                  'url',url,'license_type',license_type,'storage_scope',storage_scope,'collected_at',collected_at)::text
                FROM press_release WHERE press_id=?
                """;
                    default ->
                            """
                SELECT jsonb_build_object('news_id',e.news_id,'summary',e.summary,
                  'event_start',e.event_start,'event_end',e.event_end,'time_precision',e.time_precision,
                  'place_id',e.place_id,'place_name',e.place_name,'address',e.address,
                  'longitude',ST_X(e.geometry::geometry),'latitude',ST_Y(e.geometry::geometry),
                  'location_precision',e.location_precision,'sido',e.sido,'sigun',e.sigun,'gu',e.gu,
                  'regions',e.regions)::text FROM news_event e WHERE e.news_id=?
                """;
                };
        return jdbc.sql(sql).param(id).query(String.class).optional().map(json::readTree);
    }

    public void create(
            String id, Submit in, String origin, String card, long actor, JsonNode snapshot) {
        jdbc.sql(
                        """
            INSERT INTO review_request(review_id,origin,target_type,target_id,issue_type,card_id,reason,
              proposed_value,submitted_value,submitted_by)
            VALUES(?,?,?,?,?,?,?,?::jsonb,?::jsonb,?)
            """)
                .params(
                        id,
                        origin,
                        in.targetType(),
                        in.targetId(),
                        in.issueType(),
                        card,
                        in.reason().strip(),
                        in.proposedValue() == null || in.proposedValue().isNull()
                                ? null
                                : in.proposedValue().toString(),
                        snapshot.toString(),
                        actor)
                .update();
    }

    public Optional<Request> find(String id, boolean lock) {
        return jdbc.sql(
                        "SELECT r.*,"
                                + STATUS
                                + " AS effective_status"
                                + REQUESTS
                                + " WHERE r.review_id=?"
                                + (lock ? " FOR UPDATE OF r" : ""))
                .param(id)
                .query(this::request)
                .optional();
    }

    private Request request(ResultSet r, int n) throws SQLException {
        String proposed = r.getString("proposed_value");
        return new Request(
                r.getString("review_id"),
                r.getString("origin"),
                r.getString("target_type"),
                r.getString("target_id"),
                r.getString("issue_type"),
                r.getString("card_id"),
                r.getString("reason"),
                proposed == null ? null : json.readTree(proposed),
                json.readTree(r.getString("submitted_value")),
                r.getLong("submitted_by"),
                r.getString("effective_status"),
                r.getLong("revision"),
                r.getString("approval_request_id"),
                r.getObject("created_at", OffsetDateTime.class),
                r.getObject("updated_at", OffsetDateTime.class));
    }

    public record Filter(
            String status, String origin, String type, String issue, String card, String query) {}

    private static final String FILTER =
            " WHERE (CAST(:status AS text) IS NULL OR ("
                    + STATUS
                    + ")=:status) "
                    + """
          AND (CAST(:origin AS text) IS NULL OR r.origin=:origin)
          AND (CAST(:type AS text) IS NULL OR r.target_type=:type)
          AND (CAST(:issue AS text) IS NULL OR r.issue_type=:issue)
          AND (CAST(:card AS text) IS NULL OR r.card_id=:card)
          AND (CAST(:q AS text) IS NULL OR strpos(lower(r.target_id||' '||r.reason),lower(:q))>0)
        """;

    private JdbcClient.StatementSpec filter(String sql, Filter f) {
        return jdbc.sql(sql)
                .param("status", f.status())
                .param("origin", f.origin())
                .param("type", f.type())
                .param("issue", f.issue())
                .param("card", f.card())
                .param("q", f.query());
    }

    public Page<Request> list(Filter f, int page, int size) {
        var rows =
                filter(
                                "SELECT r.*,"
                                        + STATUS
                                        + " AS effective_status"
                                        + REQUESTS
                                        + FILTER
                                        + " ORDER BY r.created_at DESC,r.review_id LIMIT :size OFFSET :offset",
                                f)
                        .param("size", size)
                        .param("offset", (page - 1L) * size)
                        .query(this::request)
                        .list();
        long total = filter("SELECT count(*)" + REQUESTS + FILTER, f).query(Long.class).single();
        return new Page<>(rows, page, size, total);
    }

    public String approvalStatus(String id) {
        return id == null
                ? null
                : jdbc.sql("SELECT status FROM card_approval_request WHERE request_id=?")
                        .param(id)
                        .query(String.class)
                        .single();
    }

    public void finish(String id, String status, String approval) {
        jdbc.sql(
                        "UPDATE review_request SET status=?,approval_request_id=?,revision=revision+1,updated_at=now() WHERE review_id=?")
                .params(status, approval, id)
                .update();
    }

    public void audit(
            String id, Request r, Decide in, long actor, JsonNode before, JsonNode after) {
        jdbc.sql(
                        """
            INSERT INTO review_change(change_id,review_id,action,scope,actor_id,reason,before_value,after_value,revision)
            VALUES(?,?,?,?,?,?,?::jsonb,?::jsonb,?)
            """)
                .params(
                        id,
                        r.reviewId(),
                        in.action(),
                        in.scope(),
                        actor,
                        in.reason().strip(),
                        before.toString(),
                        after.toString(),
                        r.revision() + 1)
                .update();
    }

    private static final String CHANGES =
            """
        SELECT c.change_id,c.review_id,r.target_type,r.target_id,c.action,c.scope,c.actor_id,u.email AS actor_email,
          c.reason,c.before_value::text,c.after_value::text,c.revision,c.created_at
        FROM review_change c JOIN review_request r USING(review_id) JOIN app_user u ON u.id=c.actor_id
        UNION ALL
        SELECT 'card_revision:'||c.revision_id,NULL,'card',c.card_id,'approve','card',u.id,c.approved_by,c.reason,
          coalesce(b.spec,'{}'::jsonb)::text,a.spec::text,c.to_version,c.created_at
        FROM card_revision c JOIN card_version a ON a.card_id=c.card_id AND a.version=c.to_version
        LEFT JOIN card_version b ON b.card_id=c.card_id AND b.version=c.from_version
        LEFT JOIN app_user u ON u.email=c.approved_by
        """;

    private Change mapChange(ResultSet r, int n) throws SQLException {
        return new Change(
                r.getString("change_id"),
                r.getString("review_id"),
                r.getString("target_type"),
                r.getString("target_id"),
                r.getString("action"),
                r.getString("scope"),
                r.getObject("actor_id", Long.class),
                r.getString("actor_email"),
                r.getString("reason"),
                json.readTree(r.getString("before_value")),
                json.readTree(r.getString("after_value")),
                r.getLong("revision"),
                r.getObject("created_at", OffsetDateTime.class));
    }

    public List<Change> decisions(String id) {
        return jdbc.sql("SELECT * FROM (" + CHANGES + ") h WHERE review_id=? ORDER BY revision")
                .param(id)
                .query(this::mapChange)
                .list();
    }

    public record ChangeFilter(
            String type,
            String target,
            String scope,
            String action,
            Long actor,
            OffsetDateTime from,
            OffsetDateTime to) {}

    private static final String CHANGE_FILTER =
            """
        WHERE (CAST(:type AS text) IS NULL OR target_type=:type)
          AND (CAST(:target AS text) IS NULL OR target_id=:target)
          AND (CAST(:scope AS text) IS NULL OR scope=:scope)
          AND (CAST(:action AS text) IS NULL OR action=:action)
          AND (CAST(:actor AS bigint) IS NULL OR actor_id=:actor)
          AND (CAST(:from AS timestamptz) IS NULL OR created_at>=:from)
          AND (CAST(:to AS timestamptz) IS NULL OR created_at<:to)
        """;

    private JdbcClient.StatementSpec changeFilter(String sql, ChangeFilter f) {
        return jdbc.sql(sql)
                .param("type", f.type())
                .param("target", f.target())
                .param("scope", f.scope())
                .param("action", f.action())
                .param("actor", f.actor())
                .param("from", f.from())
                .param("to", f.to());
    }

    public Page<Change> changes(ChangeFilter f, int page, int size) {
        String from = " FROM (" + CHANGES + ") h " + CHANGE_FILTER;
        var rows =
                changeFilter(
                                "SELECT *"
                                        + from
                                        + " ORDER BY created_at DESC,change_id LIMIT :size OFFSET :offset",
                                f)
                        .param("size", size)
                        .param("offset", (page - 1L) * size)
                        .query(this::mapChange)
                        .list();
        return new Page<>(
                rows,
                page,
                size,
                changeFilter("SELECT count(*)" + from, f).query(Long.class).single());
    }

    public Optional<Change> change(String id) {
        return jdbc.sql("SELECT * FROM (" + CHANGES + ") h WHERE change_id=?")
                .param(id)
                .query(this::mapChange)
                .optional();
    }
}
