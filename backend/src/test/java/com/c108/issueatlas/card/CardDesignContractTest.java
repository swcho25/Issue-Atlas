package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.dto.CardStorageDto.*;
import com.c108.issueatlas.card.service.CardStorageService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** #171 카드 설계도(contracts/cards)를 고치지 않고 저장 · 검사 · 승인한다. rule 만 주 지표 행으로 옮긴다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class CardDesignContractTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired CardStorageService service;

    ObjectNode read(String file) throws Exception {
        return (ObjectNode) json.readTree(Files.readString(Path.of("../contracts/cards/" + file)));
    }

    @BeforeEach
    void dictionary() throws Exception {
        List<JsonNode> rules = List.of(read("C1.json").get("rule"), read("A3.json").get("rule"));
        for (JsonNode row : read("indicators.json").get("indicators")) {
            String id = row.get("id").asText();
            JsonNode rule =
                    rules.stream()
                            .filter(r -> r.get("indicator_id").asText().equals(id))
                            .findFirst()
                            .orElse(null);
            // 만든 카드는 #171 added_by_card(cards 는 쓰는 카드). 그 칸이 없던 계약에서는 cards[0].
            JsonNode made =
                    row.has("added_by_card") ? row.get("added_by_card") : row.get("cards").path(0);
            String owner = made.isMissingNode() || made.isNull() ? null : made.asText();
            service.saveIndicator(
                    id, new SaveIndicator(0, row, rule, null, null, null, owner, false), "fixture");
        }
    }

    boolean valid(ObjectNode card) {
        return jdbc.queryForObject(
                "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                Boolean.class,
                card.deepCopy().put("author", "writer").toString());
    }

    @Test
    void wholeIndicatorDictionaryIsStoredWithoutExtraFields() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM indicator", Integer.class))
                .isEqualTo(6);
        assertThat(service.indicator("air_pm25").rule().get("rule_id").asText())
                .isEqualTo("first_last_diff");
    }

    @Test
    void c1AndA3PassEveryCheckAndApproveWithTheirOwnRule() throws Exception {
        for (String id : List.of("C1", "A3")) {
            ObjectNode card = read(id + ".json");
            service.saveDraft(id, new SaveDraft(0L, card), "writer");
            Validation result = service.check(id);
            assertThat(result.checks()).as(id).allMatch(Check::ok);
            Version approved =
                    service.approve(
                            id, new Approve(result.draftRevision(), "#171 설계도 확인"), "approver");
            assertThat(approved.version()).isEqualTo(2);
            assertThat(approved.spec().get("rule").get("indicator_id").asText())
                    .isEqualTo(card.get("rule").get("indicator_id").asText());
            // 대표 승인 기록(approval)은 그대로, 저장 승인 기록은 card_approval.
            assertThat(approved.spec().get("approval").get("approved_fields").toString())
                    .contains("legend_text");
            assertThat(approved.spec().get("card_approval").get("approved_by").asText())
                    .isEqualTo("approver");
        }
        jdbc.execute("SET CONSTRAINTS ALL IMMEDIATE");
    }

    @Test
    void ageComesFromIndicatorIdNotFromWording() throws Exception {
        ObjectNode c1 = read("C1.json");
        ((ObjectNode) c1.get("applicability")).put("population", "청년(19–39세)");
        assertThat(valid(c1)).isTrue();
        ((ObjectNode) c1.get("applicability")).put("population", "청년 15–39세");
        assertThat(valid(c1)).isFalse();
        ObjectNode a3 = read("A3.json");
        assertThat(valid(a3)).isTrue();
        ((ObjectNode) a3.get("applicability")).put("population", "청년 19–39세");
        assertThat(valid(a3)).isFalse();
    }

    @Test
    void cardForbiddenTermsLegendClaimLevelAndMissingSourceReasonAreChecked() throws Exception {
        assertThat(valid(read("C1.json").put("claim_template", "{지역}의 탈여수가 {판정값}"))).isFalse();
        ObjectNode noLegend = read("C1.json");
        noLegend.remove("legend_text");
        assertThat(valid(noLegend)).isFalse();
        assertThat(valid(read("C1.json").put("max_claim_level", "insufficient_evidence")))
                .isFalse();
        ObjectNode noReason = read("C1.json");
        ((ArrayNode) noReason.get("evidence").get("documents")).addObject().putNull("spec_id");
        assertThat(valid(noReason)).isFalse();
    }
}
