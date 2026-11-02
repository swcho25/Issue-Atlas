package com.c108.issueatlas.card.repository;

import com.c108.issueatlas.card.dto.CardStorageDto.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class CardStorageRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public CardStorageRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void create(CreateCard request, String actor) {
        jdbc.sql(
                        """
                INSERT INTO card(card_id,name,domain,parent_question,card_version,taxonomy_version,draft_spec,updated_by)
                VALUES (:id,:name,:domain,:question,0,
                    (SELECT DISTINCT taxonomy_version FROM card),
                    jsonb_build_object('name',CAST(:name AS text),'domain',CAST(:domain AS text),
                        'parent_question',CAST(:question AS text),'author',CAST(:actor AS text)),:actor)
                """)
                .param("id", request.cardId())
                .param("name", request.name())
                .param("domain", request.domain())
                .param("question", request.parentQuestion())
                .param("actor", actor)
                .update();
    }

    public Optional<CardDraft> draft(String id) {
        return jdbc.sql(
                        """
                SELECT card_id,status,card_version,current_version,draft_revision,draft_spec::text
                FROM card WHERE card_id = ?
                """)
                .param(id)
                .query(
                        (r, n) ->
                                new CardDraft(
                                        r.getString(1),
                                        r.getString(2),
                                        r.getInt(3),
                                        r.getObject(4, Integer.class),
                                        r.getLong(5),
                                        json.readTree(r.getString(6))))
                .optional();
    }

    public int saveDraft(String id, long expected, String spec, String actor) {
        return jdbc.sql(
                        """
                UPDATE card SET draft_spec = CAST(:spec AS jsonb), draft_revision = draft_revision + 1,
                    updated_by = :actor, updated_at = now()
                WHERE card_id = :id AND draft_revision = :expected
                """)
                .param("id", id)
                .param("expected", expected)
                .param("spec", spec)
                .param("actor", actor)
                .update();
    }

    public List<Check> check(String spec) {
        return jdbc.sql("SELECT * FROM card_spec_check(CAST(? AS jsonb))")
                .param(spec)
                .query(Check.class)
                .list();
    }

    public int approve(String id, String actor, long revision, String reason) {
        return jdbc.sql("SELECT approve_card(?, ?, ?, ?)")
                .params(id, actor, revision, reason)
                .query(Integer.class)
                .single();
    }

    public Optional<Version> version(String id, int version) {
        return jdbc.sql(
                        """
                SELECT card_id,version,spec::text,draft_revision,approved_by,approved_at
                FROM card_version WHERE card_id = ? AND version = ?
                """)
                .params(id, version)
                .query(
                        (r, n) ->
                                new Version(
                                        r.getString(1),
                                        r.getInt(2),
                                        json.readTree(r.getString(3)),
                                        r.getLong(4),
                                        r.getString(5),
                                        r.getObject(6, OffsetDateTime.class)))
                .optional();
    }

    public List<Revision> revisions(String id) {
        return jdbc.sql(
                        """
                SELECT revision_id,from_version,to_version,reason,approved_by,created_at
                FROM card_revision WHERE card_id = ? ORDER BY to_version
                """)
                .param(id)
                .query(Revision.class)
                .list();
    }

    public Optional<Indicator> indicator(String id) {
        return jdbc.sql(
                        """
                SELECT indicator_id,definition::text,rule::text,rule_version,numerator_id,
                    denominator_id,base_id,added_by_card,status FROM indicator WHERE indicator_id = ?
                """)
                .param(id)
                .query(
                        (r, n) ->
                                new Indicator(
                                        r.getString(1),
                                        json.readTree(r.getString(2)),
                                        r.getString(3) == null
                                                ? null
                                                : json.readTree(r.getString(3)),
                                        r.getInt(4),
                                        r.getString(5),
                                        r.getString(6),
                                        r.getString(7),
                                        r.getString(8),
                                        r.getString(9)))
                .optional();
    }

    public int saveIndicator(String id, SaveIndicator request, String actor) {
        String sql =
                request.expectedRuleVersion() == 0
                        ? """
                INSERT INTO indicator(indicator_id,definition,rule,numerator_id,denominator_id,base_id,added_by_card,status,updated_by)
                VALUES (:id,CAST(:definition AS jsonb),CAST(:rule AS jsonb),:num,:den,:base,:card,:status,:actor)
                """
                        : """
                UPDATE indicator SET definition = CAST(:definition AS jsonb),rule = CAST(:rule AS jsonb),
                    numerator_id = :num,denominator_id = :den,base_id = :base,added_by_card = :card,
                    status = :status,updated_by = :actor
                WHERE indicator_id = :id AND rule_version = :expected
                """;
        var query =
                jdbc.sql(sql)
                        .param("id", id)
                        .param("definition", request.definition().toString())
                        .param(
                                "rule",
                                request.rule() == null || request.rule().isNull()
                                        ? null
                                        : request.rule().toString())
                        .param("num", request.numeratorId())
                        .param("den", request.denominatorId())
                        .param("base", request.baseId())
                        .param("card", request.addedByCard())
                        .param("status", request.verified() ? "verified" : "unverified")
                        .param("actor", actor);
        if (request.expectedRuleVersion() != 0)
            query.param("expected", request.expectedRuleVersion());
        return query.update();
    }
}
