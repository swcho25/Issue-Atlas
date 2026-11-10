package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.dto.CardStorageDto.*;
import com.c108.issueatlas.card.service.CardStorageService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Savepoint;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CardStorageIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CardStorageService service;
    ObjectNode spec;

    @BeforeEach
    void seed() throws Exception {
        spec =
                (ObjectNode)
                        json.readTree(
                                Files.readString(
                                        Path.of("../contracts/c3/examples/c1-draft.json")));
        seedIndicator("ind_101_15_39", "value", null, null);
        seedIndicator("ind_103_15_39", "value", null, null);
        seedIndicator("ind_102_15_39", "ratio", "ind_101_15_39", "ind_103_15_39");
        jdbc.update(
                "UPDATE card SET draft_spec=?::jsonb,draft_revision=1 WHERE card_id='C1'",
                spec.toString());
    }

    void seedIndicator(String id, String shape, String num, String den) {
        var definition =
                json.createObjectNode()
                        .put("id", id)
                        .put("label", "테스트 청년 지표")
                        .put("target", "청년 15–39세")
                        .put("unit", "명")
                        .put("period_type", "M")
                        .put("place_level", "sigungu")
                        .put("shape", shape)
                        .put("multiplier", 1000);
        definition.set("roll", json.createObjectNode().put("method", "sum").put("min_months", 12));
        definition.set("source", json.createObjectNode().put("spec_id", "SP01"));
        String rule =
                """
                {"rule_id":"direction_majority","formula_version":"test-only-0.1",
                 "thresholds":{"n":3,"k":2},"outcomes":[{"when":"otherwise","label":"불분명","claim":"unclear"}]}
                """;
        jdbc.update(
                """
                INSERT INTO indicator(indicator_id,definition,rule,numerator_id,denominator_id,added_by_card,updated_by)
                VALUES (?,?::jsonb,?::jsonb,?,?,'C1','fixture')
                """,
                id,
                definition.toString(),
                rule,
                num,
                den);
    }

    int approve() {
        return jdbc.queryForObject(
                "SELECT approve_card('C1','approver',1,'테스트 승인')", Integer.class);
    }

    JsonNode snapshot(int version) {
        return json.readTree(
                jdbc.queryForObject(
                        "SELECT spec::text FROM card_version WHERE card_id='C1' AND version=?",
                        String.class,
                        version));
    }

    void rejected(String sql, Object... args) {
        jdbc.execute(
                (ConnectionCallback<Void>)
                        connection -> {
                            Savepoint point = connection.setSavepoint();
                            try {
                                assertThatThrownBy(
                                                () ->
                                                        jdbc.execute(
                                                                sql,
                                                                (PreparedStatementCallback<Boolean>)
                                                                        statement -> {
                                                                            for (int i = 0;
                                                                                    i < args.length;
                                                                                    i++)
                                                                                statement.setObject(
                                                                                        i + 1,
                                                                                        args[i]);
                                                                            return statement
                                                                                    .execute();
                                                                        }))
                                        .isInstanceOf(DataAccessException.class);
                            } finally {
                                connection.rollback(point);
                                connection.releaseSavepoint(point);
                            }
                            return null;
                        });
    }

    @Test
    void legacyMetadataIsNotInventedApprovalAndFirstApprovalUsesVersionTwo() {
        assertThat(service.draft("C1").currentVersion()).isNull();
        assertThat(service.draft("C1").status()).isEqualTo("legacy");
        assertThat(service.check("C1").valid()).isTrue();
        assertThat(approve()).isEqualTo(2);
        assertThat(snapshot(2).path("indicator_snapshots").size()).isEqualTo(3);
        assertThat(snapshot(2).path("rule").path("rule_version").asInt()).isEqualTo(1);
        assertThat(snapshot(2).path("warrant").path("status").asText()).isEqualTo("approved");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM indicator WHERE status='verified'",
                                Integer.class))
                .isEqualTo(3);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM card_evidence_policy WHERE card_id='C1'",
                                Integer.class))
                .isEqualTo(4);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM card_rebuttal WHERE card_id='C1'",
                                Integer.class))
                .isEqualTo(2);
        jdbc.execute("SET CONSTRAINTS ALL IMMEDIATE");
    }

    @Test
    void reapprovalFreezesOldDefinitionAndDependencyRules() {
        approve();
        JsonNode old = snapshot(2);
        jdbc.update(
                "UPDATE indicator SET definition=jsonb_set(definition,'{label}','\"변경된 분모\"'),rule=jsonb_set(rule,'{thresholds,k}','3') WHERE indicator_id='ind_103_15_39'");
        jdbc.update(
                "UPDATE card SET draft_revision=2,draft_spec=jsonb_set(draft_spec,'{keywords}','[\"새 키워드\"]') WHERE card_id='C1'");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT approve_card('C1','second',2,'키워드 수정')", Integer.class))
                .isEqualTo(3);
        assertThat(snapshot(2)).isEqualTo(old);
        assertThat(snapshot(3).path("keywords").get(0).asText()).isEqualTo("새 키워드");
        assertThat(snapshot(3).path("indicator_snapshots").toString()).contains("변경된 분모");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT rule_version FROM indicator WHERE indicator_id='ind_103_15_39'",
                                Integer.class))
                .isEqualTo(2);
        assertThat(service.revisions("C1")).hasSize(2);
        jdbc.execute("SET CONSTRAINTS ALL IMMEDIATE");
    }

    @Test
    void approvedVersionAndChildrenRejectUpdateDeleteAndLateInsert() {
        approve();
        for (String table :
                List.of(
                        "card_version",
                        "card_claim_item",
                        "card_evidence_policy",
                        "card_evidence_bind",
                        "card_rebuttal")) {
            rejected("UPDATE " + table + " SET version=version WHERE card_id='C1'");
            rejected("DELETE FROM " + table + " WHERE card_id='C1'");
        }
        rejected("INSERT INTO card_claim_item VALUES ('C1',2,3,'ind_103_15_39','related',1)");
        rejected("INSERT INTO card_rebuttal VALUES ('C1',2,'C1-R3',3,'{}')");
        rejected("INSERT INTO card_evidence_bind VALUES ('C1',2,'statistics',2,'SP10','{}')");
        rejected("DELETE FROM card_revision WHERE card_id='C1'");
        rejected(
                "UPDATE indicator_rule_history SET snapshot='{}' WHERE indicator_id='ind_101_15_39'");
        // 현재 포인터를 우회해 바꿔도 이력 기반 봉인은 유지된다.
        jdbc.update(
                "UPDATE card SET current_version=null,card_version=1,status='legacy' WHERE card_id='C1'");
        rejected("INSERT INTO card_claim_item VALUES ('C1',2,3,'ind_103_15_39','related',1)");
    }

    @Test
    void malformedJsonAndIncompleteInputsYieldFailedChecksWithoutExceptions() {
        for (String invalid :
                List.of(
                        "null",
                        "[]",
                        "1",
                        "{}",
                        "{\"claim_items\":null,\"evidence\":[],\"rebuttals\":false}")) {
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                                    Boolean.class,
                                    invalid))
                    .isFalse();
        }
        for (String path :
                List.of(
                        "claim_items",
                        "evidence",
                        "warrant",
                        "rebuttals",
                        "comparability",
                        "st_type",
                        "ceiling",
                        "applicability",
                        "map_mode",
                        "legend_text")) {
            ObjectNode broken = spec.deepCopy();
            broken.putNull(path);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                                    Boolean.class,
                                    broken.toString()))
                    .isFalse();
        }
    }

    @Test
    void ruleMustNameItsOwnIndicatorAndEndWithOtherwise() {
        rejected(
                "UPDATE indicator SET rule=jsonb_set(rule,'{indicator_id}','\"ind_103_15_39\"') WHERE indicator_id='ind_101_15_39'");
        rejected(
                "UPDATE indicator SET rule=jsonb_set(rule,'{outcomes}','[{\"when\":\"rising\",\"label\":\"증가\",\"claim\":\"increasing\"}]') WHERE indicator_id='ind_101_15_39'");
        jdbc.update(
                "UPDATE indicator SET rule=jsonb_set(rule,'{indicator_id}','\"ind_101_15_39\"') WHERE indicator_id='ind_101_15_39'");
        // target 은 설명용 선택 칸, 지역 단위는 #171 과 같은 네 가지.
        jdbc.update(
                "UPDATE indicator SET definition=(definition - 'target') || '{\"place_level\":\"sido\"}' WHERE indicator_id='ind_103_15_39'");
        rejected(
                "UPDATE indicator SET definition=jsonb_set(definition,'{place_level}','\"sigungu_pair\"') WHERE indicator_id='ind_103_15_39'");
    }

    @Test
    void ageMismatchCausalClaimAndDiffusionFailWhileNegativeStatementPasses() {
        for (String claim : List.of("청년(19–39세) {판정값}", "청년(15–39세) 유출 원인은 {판정값}", "{판정값} {판정값}")) {
            ObjectNode broken = spec.deepCopy().put("claim_template", claim);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                                    Boolean.class,
                                    broken.toString()))
                    .isFalse();
        }
        ObjectNode allowed = spec.deepCopy().put("claim_template", "원인은 판단하지 않음. 청년(15–39세) {판정값}");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                                Boolean.class,
                                allowed.toString()))
                .isTrue();
        spec.set("st_type", json.createArrayNode().add("확산형"));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT bool_and(ok) FROM card_spec_check(?::jsonb)",
                                Boolean.class,
                                spec.toString()))
                .isFalse();
    }

    @Test
    void failedApprovalRollsBackIndicatorVerificationAndHeader() {
        // 승인 뒤 마지막 메타 갱신에 실패시켜 이전 INSERT/지표 확정도 함께 롤백되는지 확인.
        jdbc.execute(
                "ALTER TABLE card ADD CONSTRAINT test_reject_approval CHECK (status <> 'card')");
        rejected("SELECT approve_card('C1','approver',1,'테스트')");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_version", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_revision", Integer.class))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM indicator WHERE status='verified'",
                                Integer.class))
                .isZero();
    }

    @Test
    void duplicateApprovalAndCyclicOrUnverifiedDependenciesAreRejected() {
        jdbc.update("UPDATE indicator SET added_by_card='A3' WHERE indicator_id='ind_103_15_39'");
        rejected("SELECT approve_card('C1','approver',1,'테스트')");
        jdbc.update(
                "UPDATE indicator SET added_by_card='C1',definition=jsonb_set(definition,'{shape}','\"ratio\"'),numerator_id='ind_102_15_39',denominator_id='ind_101_15_39' WHERE indicator_id='ind_103_15_39'");
        rejected("SELECT approve_card('C1','approver',1,'테스트')");
        jdbc.update(
                "UPDATE indicator SET definition=jsonb_set(definition,'{shape}','\"value\"'),numerator_id=null,denominator_id=null WHERE indicator_id='ind_103_15_39'");
        approve();
        rejected("SELECT approve_card('C1','approver',1,'중복 승인')");
        rejected("SELECT approve_card('C1','approver',0,'오래된 초안')");
    }

    @Test
    void adminApiSavesChecksApprovesAndReturnsVersionedSnapshot() throws Exception {
        ObjectNode executable =
                (ObjectNode)
                        json.readTree(Files.readString(Path.of("../contracts/cards/C1.json")))
                                .path("rule")
                                .deepCopy();
        executable.put("indicator_id", "ind_101_15_39");
        jdbc.update(
                "UPDATE indicator SET rule = ?::jsonb WHERE indicator_id = 'ind_101_15_39'",
                executable.toString());
        ObjectNode body = json.createObjectNode().put("expected_revision", 1);
        body.set("spec", spec);
        mvc.perform(
                        put("/v1/admin/cards/C1/draft")
                                .with(user("writer").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft_revision").value(2))
                .andExpect(C3Contract.matches("CardDraft"));
        mvc.perform(get("/v1/admin/cards/C1/checks").with(user("writer").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(C3Contract.matches("Validation"));
        jdbc.update(
                "INSERT INTO app_user(email,password_hash,name,role) VALUES ('writer','test-only','writer','ADMIN'),('approver','test-only','approver','ADMIN')");
        long approverId =
                jdbc.queryForObject("SELECT id FROM app_user WHERE email='approver'", Long.class);
        mvc.perform(
                        post("/v1/admin/cards/C1/approval-requests")
                                .with(user("writer").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":2,\"approver_id\":"
                                                + approverId
                                                + ",\"reason\":\"검토 요청\"}"))
                .andExpect(status().isCreated());
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user("approver").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":2,\"reason\":\"검토 완료\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.approved_by").value("approver"))
                .andExpect(jsonPath("$.spec.author").value("writer"))
                .andExpect(C3Contract.matches("Version"));
        mvc.perform(get("/v1/admin/cards/C1/versions/2").with(user("reader").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spec.indicator_snapshots.length()").value(3));
    }

    @Test
    void adminApiRejectsDirectApprovalWithoutRequest() throws Exception {
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user("approver").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":1,\"reason\":\"검토 완료\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HTTP_ERROR"));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM card_version WHERE card_id = 'C1'",
                                Integer.class))
                .isZero();
    }

    @Test
    void staleSaveAndUnauthorizedRequestsAreRejected() throws Exception {
        ObjectNode body = json.createObjectNode().put("expected_revision", 0);
        body.set("spec", spec);
        mvc.perform(
                        put("/v1/admin/cards/C1/draft")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString()))
                .andExpect(status().isConflict());
        mvc.perform(get("/v1/admin/cards/C1/draft")).andExpect(status().isUnauthorized());
        mvc.perform(get("/v1/admin/cards/C1/draft").with(user("reader").roles("READER")))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":1,\"reason\":\"승인\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/v1/admin/cards/C1/versions/1").with(user("admin").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void newCandidatesStayOutOfPublicCatalogAndQuestionExecution() throws Exception {
        service.create(new CreateCard("C9", "새 카드", "C 인구·지역소멸", "대표 질문"), "admin");
        assertThat(service.draft("C9").cardVersion()).isZero();
        jdbc.update(
                "INSERT INTO place(place_id,name,level) VALUES ('storage-test','시험 지역','sigungu')");
        mvc.perform(
                        get("/v1/places/storage-test/cards?period_start=2023-01-01&period_end=2026-01-01")
                                .with(user("reader")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards.length()").value(2));
        mvc.perform(
                        post("/v1/questions")
                                .with(user("reader"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"place_id\":\"storage-test\",\"card_id\":\"C9\",\"period_start\":\"2023-01-01\",\"period_end\":\"2026-01-01\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void indicatorApiTracksRuleEditsAndRejectsMalformedDefinition() throws Exception {
        Indicator existing = service.indicator("ind_101_15_39");
        ObjectNode definition = (ObjectNode) existing.definition().deepCopy();
        definition.put("id", "api_indicator");
        ObjectNode body =
                json.createObjectNode().put("expected_rule_version", 0).put("verified", true);
        body.set("definition", definition);
        body.set("rule", existing.rule());
        mvc.perform(
                        put("/v1/admin/indicators/api_indicator")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rule_version").value(1))
                .andExpect(C3Contract.matches("Indicator"));
        body.put("expected_rule_version", 1);
        ((ObjectNode) body.get("rule").get("thresholds")).put("k", 3);
        mvc.perform(
                        put("/v1/admin/indicators/api_indicator")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rule_version").value(2));
        mvc.perform(
                        put("/v1/admin/indicators/api_indicator")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.toString()))
                .andExpect(status().isConflict());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM indicator_rule_history WHERE indicator_id='api_indicator'",
                                Integer.class))
                .isEqualTo(2);
    }

    @Test
    void invalidIndicatorIsBadRequestWithoutSqlLeak() throws Exception {
        mvc.perform(
                        put("/v1/admin/indicators/bad_indicator")
                                .with(user("admin").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_rule_version\":0,\"definition\":{}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(
                        content()
                                .string(
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.containsString(
                                                        "invalid indicator definition"))));
    }
}
