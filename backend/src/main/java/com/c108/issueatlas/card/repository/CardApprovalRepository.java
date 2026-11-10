package com.c108.issueatlas.card.repository;

import com.c108.issueatlas.card.dto.CardApprovalDto.*;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class CardApprovalRepository {
    private static final String REQUEST =
            """
        SELECT a.request_id,a.card_id,a.draft_revision,a.requested_by,u.name AS requester_name,
            a.approver_id,v.name AS approver_name,a.status,a.reason,a.revision,a.created_at,
            a.decided_by,a.decided_at,a.decision_reason,a.approved_version
        FROM card_approval_request a JOIN app_user u ON u.id=a.requested_by
        JOIN app_user v ON v.id=a.approver_id
        """;
    private static final String FILTER =
            """
        WHERE (CAST(:status AS text) IS NULL OR a.status=CAST(:status AS text))
          AND (CAST(:card AS text) IS NULL OR a.card_id=CAST(:card AS text))
          AND (CAST(:approver AS bigint) IS NULL OR a.approver_id=CAST(:approver AS bigint))
          AND (CAST(:requester AS bigint) IS NULL OR a.requested_by=CAST(:requester AS bigint))
        """;
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public CardApprovalRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public record Actor(long id, String email) {}

    public Optional<Actor> activeActor(String email) {
        return jdbc.sql(
                        "SELECT id,email FROM app_user WHERE email=? AND role='ADMIN' AND is_active FOR SHARE")
                .param(email)
                .query(Actor.class)
                .optional();
    }

    public Optional<Actor> activeApprover(long id) {
        return jdbc.sql(
                        "SELECT id,email FROM app_user WHERE id=? AND role='ADMIN' AND is_active FOR SHARE")
                .param(id)
                .query(Actor.class)
                .optional();
    }

    public Optional<Request> find(String id) {
        return jdbc.sql(REQUEST + " WHERE a.request_id=?")
                .param(id)
                .query(Request.class)
                .optional();
    }

    public Optional<String> cardId(String requestId) {
        return jdbc.sql("SELECT card_id FROM card_approval_request WHERE request_id=?")
                .param(requestId)
                .query(String.class)
                .optional();
    }

    public Optional<String> openId(String cardId) {
        return jdbc.sql(
                        "SELECT request_id FROM card_approval_request WHERE card_id=? AND status IN ('pending','on_hold')")
                .param(cardId)
                .query(String.class)
                .optional();
    }

    public boolean isApprovedDraft(String cardId) {
        return jdbc.sql(
                        "SELECT coalesce(approved_draft_revision=draft_revision,false) FROM card WHERE card_id=?")
                .param(cardId)
                .query(Boolean.class)
                .single();
    }

    public void lock(String id) {
        jdbc.sql("SELECT request_id FROM card_approval_request WHERE request_id=? FOR UPDATE")
                .param(id)
                .query(String.class)
                .single();
    }

    public JsonNode indicatorVersions(String spec) {
        return json.readTree(
                jdbc.sql(
                                """
            WITH RECURSIVE used(id) AS (
                SELECT x->>'indicator_id' FROM jsonb_array_elements(CAST(? AS jsonb)->'claim_items') x
                UNION
                SELECT dep FROM used u JOIN indicator i ON i.indicator_id=u.id
                CROSS JOIN LATERAL unnest(ARRAY[i.numerator_id,i.denominator_id,i.base_id]) dep
                WHERE dep IS NOT NULL
            ) SELECT coalesce(jsonb_object_agg(i.indicator_id,i.rule_version),'{}'::jsonb)::text
              FROM indicator i JOIN used u ON i.indicator_id=u.id
            """)
                        .param(spec)
                        .query(String.class)
                        .single());
    }

    public void create(
            String id,
            String card,
            long revision,
            String spec,
            String indicators,
            long actor,
            long approver,
            String reason) {
        jdbc.sql(
                        """
            INSERT INTO card_approval_request(request_id,card_id,draft_revision,draft_spec,
                indicator_versions,requested_by,approver_id,reason)
            VALUES (?,?,?,?::jsonb,?::jsonb,?,?,?)
            """)
                .params(id, card, revision, spec, indicators, actor, approver, reason)
                .update();
    }

    public JsonNode snapshot(String id, boolean indicators) {
        String column = indicators ? "indicator_versions" : "draft_spec";
        return json.readTree(
                jdbc.sql(
                                "SELECT "
                                        + column
                                        + "::text FROM card_approval_request WHERE request_id=?")
                        .param(id)
                        .query(String.class)
                        .single());
    }

    public List<Decision> decisions(String id) {
        return jdbc.sql(
                        "SELECT decision_id,actor_id,decision,reason,created_at FROM card_approval_decision WHERE request_id=? ORDER BY decision_id")
                .param(id)
                .query(Decision.class)
                .list();
    }

    public void decide(String id, long actor, String decision, String reason, Integer version) {
        String state =
                switch (decision) {
                    case "approve" -> "approved";
                    case "reject" -> "rejected";
                    default -> "on_hold";
                };
        jdbc.sql(
                        """
            UPDATE card_approval_request SET status=:state,revision=revision+1,decided_by=:actor,
                decided_at=now(),decision_reason=:reason,approved_version=:version WHERE request_id=:id
            """)
                .param("state", state)
                .param("actor", actor)
                .param("reason", reason)
                .param("version", version)
                .param("id", id)
                .update();
        jdbc.sql(
                        "INSERT INTO card_approval_decision(request_id,actor_id,decision,reason) VALUES (?,?,?,?)")
                .params(id, actor, decision, reason)
                .update();
    }

    private JdbcClient.StatementSpec filter(
            String sql, String status, String card, Long approver, Long requester) {
        return jdbc.sql(sql)
                .param("status", status)
                .param("card", card)
                .param("approver", approver)
                .param("requester", requester);
    }

    public Page list(
            String status, String card, Long approver, Long requester, int page, int size) {
        var items =
                filter(
                                REQUEST
                                        + FILTER
                                        + " ORDER BY a.created_at DESC,a.request_id LIMIT :limit OFFSET :offset",
                                status,
                                card,
                                approver,
                                requester)
                        .param("limit", size)
                        .param("offset", (page - 1L) * size)
                        .query(Request.class)
                        .list();
        long count =
                filter(
                                "SELECT count(*) FROM card_approval_request a " + FILTER,
                                status,
                                card,
                                approver,
                                requester)
                        .query(Long.class)
                        .single();
        return new Page(items, page, size, count);
    }
}
