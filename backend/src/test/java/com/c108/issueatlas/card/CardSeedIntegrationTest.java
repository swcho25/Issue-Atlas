package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 운영 seed(db/seed/cards-c1-a3.sql, scripts/card-seed.mjs 가 만듦)가 contracts/cards 그대로 지표 사전과 C1 · A3
 * 승인본 v2 를 만드는지 본다(S15P31C108-159).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class CardSeedIntegrationTest {
    static final Path SEED = Path.of("db/seed/cards-c1-a3.sql");
    static final Path CARDS = Path.of("../contracts/cards");
    static final List<String> CARD_IDS = List.of("C1", "A3");
    static final String APPROVER = "admin@seed.test";

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    void runSeed(String approver) throws Exception {
        jdbc.queryForObject(
                "SELECT set_config('issue_atlas.approver', ?, true)", String.class, approver);
        jdbc.execute(Files.readString(SEED));
    }

    ObjectNode contract(String file) throws Exception {
        return (ObjectNode) json.readTree(Files.readString(CARDS.resolve(file)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"C1", "A3"})
    void seedApprovesContractCardAsVersionTwo(String cardId) throws Exception {
        runSeed(APPROVER);
        ObjectNode card = contract(cardId + ".json");

        assertThat(
                        jdbc.queryForMap(
                                "SELECT status,card_version,current_version,updated_by FROM card WHERE card_id=?",
                                cardId))
                .containsEntry("status", "card")
                .containsEntry("card_version", 2)
                .containsEntry("current_version", 2)
                .containsEntry("updated_by", APPROVER);

        ObjectNode spec =
                (ObjectNode)
                        json.readTree(
                                jdbc.queryForObject(
                                        "SELECT spec::text FROM card_version WHERE card_id=? AND version=2",
                                        String.class,
                                        cardId));
        ObjectNode rule = (ObjectNode) card.get("rule").deepCopy();
        assertThat(spec.get("rule")).isEqualTo(rule.put("rule_version", 1));
        assertThat(spec.get("author").asText()).isEqualTo(APPROVER);
        assertThat(spec.at("/card_approval/approved_by").asText()).isEqualTo(APPROVER);
        assertThat(spec.at("/card_approval/reason").asText()).contains("S15P31C108-159");

        // 나머지 칸은 카드 파일 그대로(대표 approval 포함). 보증 · 반박은 승인되며 approved 가 된다
        ObjectNode expected = card.deepCopy();
        expected.remove(List.of("card_id", "card_version", "status", "rule"));
        ((ObjectNode) expected.get("warrant")).put("status", "approved");
        ((ObjectNode) expected.get("rebuttals")).put("status", "approved");
        ObjectNode actual = spec.deepCopy();
        actual.remove(
                List.of(
                        "card_id",
                        "card_version",
                        "status",
                        "taxonomy_version",
                        "indicator_snapshots",
                        "rule",
                        "card_approval",
                        "author"));
        assertThat(actual).isEqualTo(expected);
    }

    @Test
    void seedStoresWholeDictionaryAsContract() throws Exception {
        runSeed(APPROVER);
        Map<String, ObjectNode> cards =
                Map.of("C1", contract("C1.json"), "A3", contract("A3.json"));
        JsonNode rows = contract("indicators.json").get("indicators");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM indicator", Integer.class))
                .isEqualTo(rows.size());
        for (JsonNode row : rows) {
            String id = row.get("id").asText();
            String owner =
                    row.has("added_by_card")
                            ? row.get("added_by_card").asText()
                            : row.get("cards").path(0).asText(null);
            JsonNode rule =
                    cards.values().stream()
                            .map(c -> c.get("rule"))
                            .filter(r -> r.get("indicator_id").asText().equals(id))
                            .findFirst()
                            .orElse(null);
            // 카드가 승인될 때 그 카드가 넣고 판단에 쓰는 지표만 검수된다
            boolean verified =
                    owner != null
                            && CARD_IDS.contains(owner)
                            && cards.get(owner)
                                    .get("claim_items")
                                    .toString()
                                    .contains('"' + id + '"');
            Map<String, Object> stored =
                    jdbc.queryForMap(
                            "SELECT definition::text AS definition, rule::text AS rule, added_by_card, status"
                                    + " FROM indicator WHERE indicator_id=?",
                            id);
            assertThat(json.readTree((String) stored.get("definition"))).as(id).isEqualTo(row);
            assertThat(
                            stored.get("rule") == null
                                    ? null
                                    : json.readTree((String) stored.get("rule")))
                    .as(id)
                    .isEqualTo(rule);
            assertThat(stored)
                    .as(id)
                    .containsEntry("added_by_card", owner)
                    .containsEntry("status", verified ? "verified" : "unverified");
        }
    }

    @Test
    void secondRunLeavesApprovedCardsAlone() throws Exception {
        runSeed(APPROVER);
        runSeed("other@seed.test");
        assertThat(
                        jdbc.queryForList(
                                "SELECT card_id || ':' || to_version || ':' || approved_by FROM card_revision"
                                        + " WHERE card_id IN ('C1','A3') ORDER BY card_id",
                                String.class))
                .containsExactly("A3:2:" + APPROVER, "C1:2:" + APPROVER);
    }

    @Test
    void seedNeedsApprover() throws Exception {
        String seed = Files.readString(SEED);
        assertThatThrownBy(() -> jdbc.execute(seed))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("issue_atlas.approver");
    }

    @Test
    void seedStopsWhenDictionaryDiffers() throws Exception {
        ObjectNode other = (ObjectNode) contract("indicators.json").get("indicators").get(5);
        assertThat(other.get("id").asText()).isEqualTo("air_pm25");
        jdbc.update(
                "INSERT INTO indicator(indicator_id,definition,updated_by) VALUES ('air_pm25',?::jsonb,'other')",
                other.put("label", "다른 정의").toString());
        assertThatThrownBy(() -> runSeed(APPROVER))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("air_pm25");
    }
}
