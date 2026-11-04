package com.c108.issueatlas.operations;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class OperationsApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    String place;
    long actor;

    @BeforeEach
    void seed() {
        place =
                jdbc.queryForObject(
                        "SELECT place_id FROM place ORDER BY place_id LIMIT 1", String.class);
        jdbc.update(
                "INSERT INTO app_user(email,password_hash,name,role) VALUES ('ops@test.local','test','운영자','ADMIN')");
        actor =
                jdbc.queryForObject(
                        "SELECT id FROM app_user WHERE email='ops@test.local'", Long.class);
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES ('ops-source','검증 출처','test','test','metadata'),('ops-empty','미실행 출처','test','test','metadata')");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES ('ops-spec','ops-source','file','documents'),('ops-never','ops-source','file','documents')");
    }

    String result(boolean documentsRequired, String documentStatus) {
        return """
            {"evidence_table":[
              {"kind":"statistics","required":true,"status":"available"},
              {"kind":"documents","required":%s,"status":"%s"}],
             "question":{"raw_marker":"saved-result"}}
            """
                .formatted(documentsRequired, documentStatus);
    }

    void run(
            String id,
            String placeId,
            String card,
            String start,
            Integer filled,
            Integer edits,
            String previous,
            int version,
            String result) {
        jdbc.update(
                "INSERT INTO question(question_id,place_id,card_id,period_start,period_end,raw_text) VALUES (?,?,?,DATE '2023-01-01',DATE '2026-01-01','화면에 내보내지 않는 질문')",
                "q-" + id,
                placeId,
                card);
        jdbc.update(
                """
            INSERT INTO argument_run(run_id,question_id,run_status,card_version,formula_version,taxonomy_version,
                result,created_at,previous_run_id,filled_cells,edit_count,duration_ms)
            VALUES (?,?,'ready',?,'formula-1','tax-test',CAST(? AS jsonb),?,?,?, ?,123)
            """,
                id,
                "q-" + id,
                version,
                result,
                OffsetDateTime.parse(start),
                previous,
                filled,
                edits);
    }

    ResultActions getAdmin(String path) throws Exception {
        return mvc.perform(get(path).with(user("ops@test.local").roles("ADMIN")));
    }

    JsonNode compare(String before, String after) throws Exception {
        return json.readTree(
                getAdmin(
                                "/v1/admin/run-comparisons?before_run_id="
                                        + before
                                        + "&after_run_id="
                                        + after)
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    @Test
    void storedResultsAreComparedWithoutRecalculationOrWrites() throws Exception {
        run(
                "before",
                place,
                "C1",
                "2024-01-01T00:00:00Z",
                3,
                0,
                null,
                1,
                result(true, "review_pending"));
        run(
                "after",
                place,
                "C1",
                "2024-01-02T00:00:00Z",
                6,
                2,
                "before",
                1,
                result(true, "available"));
        Map<String, Object> before =
                jdbc.queryForMap(
                        "SELECT result::text AS result,filled_cells,edit_count,duration_ms FROM argument_run WHERE run_id='after'");
        var response = compare("before", "after");
        assertThat(response.path("comparable").asBoolean()).isTrue();
        assertThat(
                        response.path("before")
                                .path("metrics")
                                .path("required_evidence")
                                .path("rate")
                                .path("percentage")
                                .asDouble())
                .isEqualTo(50);
        assertThat(response.path("deltas").path("filled_cells").path("value").asDouble())
                .isEqualTo(50);
        assertThat(response.path("deltas").path("required_evidence").path("value").asDouble())
                .isEqualTo(50);
        assertThat(response.path("deltas").path("edited_cells").path("value").asInt()).isEqualTo(2);
        assertThat(
                        response.path("after")
                                .path("result")
                                .path("question")
                                .path("raw_marker")
                                .asText())
                .isEqualTo("saved-result");
        assertThat(response.path("linked_review_changes").path("unavailable_reason").asText())
                .isEqualTo("run_review_link_not_recorded");
        assertThat(response.toString()).doesNotContain("duration_ms", "raw_text", "123");
        assertThat(
                        jdbc.queryForMap(
                                "SELECT result::text AS result,filled_cells,edit_count,duration_ms FROM argument_run WHERE run_id='after'"))
                .isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM argument_run", Long.class))
                .isEqualTo(2);
    }

    @Test
    void missingHistoricalMetricsRemainNullInsteadOfCurrentValuesOrZero() throws Exception {
        run("old", place, "C1", "2024-01-01T00:00:00Z", null, null, null, 1, "{}");
        run(
                "new",
                place,
                "C1",
                "2024-01-02T00:00:00Z",
                6,
                null,
                "old",
                1,
                result(true, "available"));
        var response = compare("old", "new");
        assertThat(
                        response.path("before")
                                .path("metrics")
                                .path("filled_cells")
                                .path("percentage")
                                .isNull())
                .isTrue();
        assertThat(response.path("deltas").path("edited_cells").path("value").isNull()).isTrue();
        assertThat(response.path("deltas").path("edited_cells").path("unavailable_reason").asText())
                .isEqualTo("edit_count_not_recorded");
        assertThat(response.path("deltas").path("required_evidence").path("value").isNull())
                .isTrue();
    }

    @Test
    void requiredEvidencePolicyChangesBlockOnlyThatDeltaAndExposeVersions() throws Exception {
        run(
                "policy1",
                place,
                "C1",
                "2024-01-01T00:00:00Z",
                2,
                null,
                null,
                1,
                result(true, "not_collected"));
        run(
                "policy2",
                place,
                "C1",
                "2024-01-02T00:00:00Z",
                4,
                null,
                "policy1",
                2,
                result(false, "available"));
        var response = compare("policy1", "policy2");
        assertThat(response.path("comparable").asBoolean()).isTrue();
        assertThat(response.path("warnings").toString())
                .contains("required_evidence_policy_changed", "card_version_changed");
        assertThat(response.path("deltas").path("required_evidence").path("value").isNull())
                .isTrue();
        assertThat(response.path("deltas").path("filled_cells").path("value").asDouble())
                .isEqualTo(33.33);
    }

    @Test
    void differentConditionsUnsupportedAndReverseOrderDoNotProduceImprovementNumbers()
            throws Exception {
        run(
                "one",
                place,
                "C1",
                "2024-01-01T00:00:00Z",
                3,
                null,
                null,
                1,
                result(true, "available"));
        run(
                "two",
                place,
                "A3",
                "2024-01-02T00:00:00Z",
                6,
                null,
                null,
                1,
                result(true, "available"));
        var mismatch = compare("one", "two");
        assertThat(mismatch.path("comparable").asBoolean()).isFalse();
        assertThat(mismatch.path("reasons").toString()).contains("card_mismatch");
        assertThat(mismatch.path("deltas").path("filled_cells").path("value").isNull()).isTrue();
        assertThat(compare("two", "one").path("reasons").toString()).contains("run_order_invalid");
        run("unsupported", place, null, "2024-01-03T00:00:00Z", 0, null, null, 1, "{}");
        jdbc.update("UPDATE argument_run SET run_status='unsupported' WHERE run_id='unsupported'");
        assertThat(compare("one", "unsupported").path("reasons").toString())
                .contains("card_not_selected", "unsupported_run");
    }

    @Test
    void executionListFiltersPaginatesAndDoesNotExposeResultsOrRawQuestions() throws Exception {
        run(
                "first",
                place,
                "C1",
                "2024-01-01T00:00:00Z",
                3,
                null,
                null,
                1,
                result(true, "available"));
        run(
                "second",
                place,
                "C1",
                "2024-01-02T00:00:00Z",
                6,
                null,
                "first",
                1,
                result(true, "available"));
        run(
                "third",
                place,
                "A3",
                "2024-01-03T00:00:00Z",
                6,
                null,
                null,
                1,
                result(true, "available"));
        var response =
                json.readTree(
                        getAdmin(
                                        "/v1/admin/argument-runs?card_id=C1&period_start=2023-01-01&period_end=2026-01-01&size=1&page=2")
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        assertThat(response.path("total").asLong()).isEqualTo(2);
        assertThat(response.path("items").path(0).path("run_id").asText()).isEqualTo("first");
        assertThat(response.toString()).doesNotContain("duration_ms", "raw_text", "saved-result");
        getAdmin("/v1/admin/argument-runs?place_id=unknown")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void overviewSeparatesCurrentQueuesFromTimeBoundedActivityAndUnknownSources() throws Exception {
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at,finished_at,status) VALUES ('ops-from','ops-spec','test',TIMESTAMPTZ '2024-01-01 00:00Z',TIMESTAMPTZ '2024-01-01 00:01Z','ok'),('ops-to','ops-spec','test',TIMESTAMPTZ '2024-02-01 00:00Z',TIMESTAMPTZ '2024-02-01 00:01Z','failed'),('ops-running','ops-spec','test',TIMESTAMPTZ '2024-01-15 00:00Z',NULL,NULL)");
        jdbc.update(
                "INSERT INTO review_request(review_id,origin,target_type,target_id,issue_type,reason,submitted_value,submitted_by,status,created_at) VALUES ('ops-review','admin','source','ops-source','metadata','test','{}',?,'resolved',TIMESTAMPTZ '2023-12-01 00:00Z')",
                actor);
        jdbc.update(
                "INSERT INTO review_change(change_id,review_id,action,scope,actor_id,reason,before_value,after_value,revision,created_at) VALUES ('ops-from','ops-review','confirm','source',?,'test','{}','{}',1,TIMESTAMPTZ '2024-01-01 00:00Z'),('ops-to','ops-review','correct','source',?,'test','{}','{}',2,TIMESTAMPTZ '2024-02-01 00:00Z')",
                actor,
                actor);
        jdbc.update(
                "INSERT INTO csv_import_request(import_id,requested_by,assignee_id,request_key,fingerprint,file_name,file_sha256,file_data,template_version,status,validation,created_at) VALUES ('ops-import',?,?,'ops-key','hash','test.csv','hash',?,'1','completed','{}',TIMESTAMPTZ '2023-12-01 00:00Z')",
                actor,
                actor,
                "test".getBytes(StandardCharsets.UTF_8));
        jdbc.update(
                "INSERT INTO csv_import_result(import_id,actor_id,status,reason,loaded_rows,skipped_rows,created_at) VALUES ('ops-import',?,'completed','test',2,0,TIMESTAMPTZ '2024-01-20 00:00Z')",
                actor);
        var response =
                json.readTree(
                        getAdmin(
                                        "/v1/admin/overview?from=2024-01-01T00:00:00Z&to=2024-02-01T00:00:00Z")
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        assertThat(response.path("current_queues").path("reviews").path("resolved").asInt())
                .isEqualTo(1);
        assertThat(response.path("current_queues").path("imports").path("completed").asInt())
                .isEqualTo(1);
        var period = response.path("period_activity");
        assertThat(period.path("review_decisions").path("confirm").asInt()).isEqualTo(1);
        assertThat(period.path("review_decisions").path("correct").asInt()).isZero();
        assertThat(period.path("import_results").path("completed").asInt()).isEqualTo(1);
        assertThat(period.path("jobs_started").path("ok").asInt()).isEqualTo(1);
        assertThat(period.path("jobs_started").path("failed").asInt()).isZero();
        assertThat(period.path("jobs_started").path("running").asInt()).isEqualTo(1);
        var sources = response.path("source_statuses");
        boolean found = false;
        for (var source : sources)
            if (source.path("source_id").asText().equals("ops-source")) {
                found = true;
                assertThat(source.path("latest_job_status").asText()).isEqualTo("failed");
                assertThat(source.path("never_run_spec_count").asLong()).isEqualTo(1);
                assertThat(source.path("last_successful_at").isNull()).isFalse();
            } else if (source.path("source_id").asText().equals("ops-empty")) {
                assertThat(source.path("latest_job_status").asText()).isEqualTo("unknown");
                assertThat(source.path("last_successful_at").isNull()).isTrue();
            }
        assertThat(found).isTrue();
    }

    @Test
    void reviewQueueReflectsApprovalHoldsInsteadOfStaleForwardedStatus() throws Exception {
        jdbc.update(
                "INSERT INTO card_approval_request(request_id,card_id,draft_revision,draft_spec,indicator_versions,requested_by,approver_id,reason,status,decided_by,decided_at,decision_reason) VALUES ('ops-approval','C1',0,'{}','{}',?,?,'test','on_hold',?,now(),'hold')",
                actor,
                actor,
                actor);
        jdbc.update(
                "INSERT INTO review_request(review_id,origin,target_type,target_id,issue_type,reason,submitted_value,submitted_by,status,approval_request_id) VALUES ('ops-forwarded','admin','source','ops-source','metadata','test','{}',?,'approval_pending','ops-approval')",
                actor);
        getAdmin("/v1/admin/overview")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current_queues.reviews.on_hold").value(1))
                .andExpect(jsonPath("$.current_queues.reviews.approval_pending").value(0))
                .andExpect(jsonPath("$.current_queues.approvals.on_hold").value(1));
    }

    @Test
    void permissionsMissingRunsAndInvalidInputUseStandardErrors() throws Exception {
        for (String path :
                List.of(
                        "/v1/admin/overview",
                        "/v1/admin/argument-runs",
                        "/v1/admin/run-comparisons?before_run_id=a&after_run_id=b")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(user("viewer").roles("VIEWER")))
                    .andExpect(status().isForbidden());
        }
        getAdmin("/v1/admin/run-comparisons?before_run_id=a&after_run_id=b")
                .andExpect(status().isNotFound());
        for (String path :
                List.of(
                        "/v1/admin/run-comparisons?before_run_id=a&after_run_id=a",
                        "/v1/admin/run-comparisons?before_run_id=&after_run_id=b",
                        "/v1/admin/argument-runs?page=0",
                        "/v1/admin/argument-runs?size=101",
                        "/v1/admin/argument-runs?period_start=2025-01-01&period_end=2024-01-01",
                        "/v1/admin/overview?from=2024-02-01T00:00:00Z&to=2024-01-01T00:00:00Z"))
            getAdmin(path)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void incompleteEvidencePolicyAndZeroDenominatorRemainUnavailable() throws Exception {
        run("base", place, "C1", "2024-01-01T00:00:00Z", 0, 0, null, 1, result(true, "available"));
        List<String> invalid =
                List.of(
                        "{}",
                        "{\"evidence_table\":[]}",
                        "{\"evidence_table\":[{\"kind\":\"statistics\",\"required\":true}]}",
                        "{\"evidence_table\":[{\"kind\":\"statistics\",\"required\":true,\"status\":\"available\"},{\"kind\":\"statistics\",\"required\":true,\"status\":\"available\"}]}");
        for (int i = 0; i < invalid.size(); i++) {
            String id = "invalid-policy-" + i;
            run(id, place, "C1", "2024-01-02T00:00:00Z", 0, null, "base", 1, invalid.get(i));
            var response = compare("base", id);
            assertThat(
                            response.path("after")
                                    .path("metrics")
                                    .path("required_evidence")
                                    .path("rate")
                                    .path("unavailable_reason")
                                    .asText())
                    .isEqualTo("evidence_policy_not_recorded");
        }
        run(
                "none-required",
                place,
                "C1",
                "2024-01-03T00:00:00Z",
                0,
                0,
                "base",
                1,
                "{\"evidence_table\":[{\"kind\":\"statistics\",\"required\":false,\"status\":\"available\"}]}");
        var none = compare("base", "none-required");
        var rate = none.path("after").path("metrics").path("required_evidence").path("rate");
        assertThat(rate.path("denominator").asInt()).isZero();
        assertThat(rate.path("percentage").isNull()).isTrue();
        assertThat(rate.path("unavailable_reason").asText()).isEqualTo("no_required_evidence");
        assertThat(none.path("after").path("metrics").path("edited_cells").path("value").asInt())
                .isZero();
        assertThat(
                        none.path("after")
                                .path("metrics")
                                .path("filled_cells")
                                .path("percentage")
                                .asDouble())
                .isZero();
    }

    @Test
    void placeAndPeriodDifferencesAreReportedAndEveryDeltaIsUnavailable() throws Exception {
        String other =
                jdbc.queryForObject(
                        "SELECT place_id FROM place WHERE place_id<>? ORDER BY place_id LIMIT 1",
                        String.class,
                        place);
        run(
                "scope-before",
                place,
                "C1",
                "2024-01-01T00:00:00Z",
                3,
                0,
                null,
                1,
                result(true, "available"));
        run(
                "scope-after",
                other,
                "C1",
                "2024-01-02T00:00:00Z",
                6,
                1,
                null,
                1,
                result(true, "available"));
        jdbc.update(
                "UPDATE question SET period_end=DATE '2025-01-01' WHERE question_id='q-scope-after'");
        var response = compare("scope-before", "scope-after");
        assertThat(response.path("reasons").toString())
                .contains("place_mismatch", "period_mismatch");
        for (String metric : List.of("filled_cells", "required_evidence", "edited_cells")) {
            assertThat(response.path("deltas").path(metric).path("value").isNull()).isTrue();
            assertThat(response.path("deltas").path(metric).path("unavailable_reason").asText())
                    .isEqualTo("conditions_not_comparable");
        }
    }

    @Test
    void emptyQueuesAndDefaultPeriodAreExplicitAndSwaggerFieldsMatchJson() throws Exception {
        var response =
                json.readTree(
                        getAdmin("/v1/admin/overview")
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        var period = response.path("period");
        assertThat(
                        java.time.Duration.between(
                                        OffsetDateTime.parse(period.path("from").asText()),
                                        OffsetDateTime.parse(period.path("to").asText()))
                                .toDays())
                .isEqualTo(7);
        assertThat(response.path("current_queues").path("reviews").path("pending").asLong())
                .isZero();
        var docs =
                json.readTree(
                        mvc.perform(get("/v3/api-docs"))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        for (String path :
                List.of(
                        "/v1/admin/overview",
                        "/v1/admin/argument-runs",
                        "/v1/admin/run-comparisons"))
            assertThat(docs.path("paths").path(path).has("get")).isTrue();
        assertThat(
                        docs.at("/components/schemas/OperationsOverview/properties")
                                .has("current_queues"))
                .isTrue();
        assertThat(docs.at("/components/schemas/OperationsRun/properties").has("previous_run_id"))
                .isTrue();
        assertThat(
                        docs.at("/components/schemas/OperationsComparison/properties")
                                .has("linked_review_changes"))
                .isTrue();
    }

    @Test
    void inventoryCountsStagesSeparatelyAndTimeFiltersRespectOffsets() throws Exception {
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at) VALUES ('ops-inventory','ops-spec','test',TIMESTAMPTZ '2024-01-01 00:00Z')");
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,file_name,content_hash,collected_at) VALUES ('ops-inventory','ops-spec','test.csv','ops-hash1',now()),('ops-inventory','ops-spec','test.csv','ops-hash2',now())");
        jdbc.update(
                "INSERT INTO normalized_record(content_hash,source_id,spec_id,validation_status,issues,rule_version,record) VALUES ('ops-hash1','ops-source','ops-spec','held','[]','p2-test','{}')");
        mvc.perform(
                        get("/v1/admin/overview")
                                .param("from", "2024-01-01T09:00:00+09:00")
                                .param("to", "2024-01-02T09:00:00+09:00")
                                .with(user("ops@test.local").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current_inventory.raw_records").value(2))
                .andExpect(jsonPath("$.current_inventory.normalized_records").value(1))
                .andExpect(jsonPath("$.current_inventory.ready_records").value(0))
                .andExpect(jsonPath("$.period_activity.jobs_started.running").value(1));
    }
}
