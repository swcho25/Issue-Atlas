package com.c108.issueatlas.card;

import static com.c108.issueatlas.card.CardApprovalFixture.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.service.CardStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReviewIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CardStorageService cards;
    ObjectNode spec;

    @BeforeEach
    void seed() throws Exception {
        spec = CardApprovalFixture.seed(jdbc, json, cards);
        jdbc.update(
                """
            INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade,robots_status)
            VALUES('review-source','원래 출처','기관','test','metadata','B','allowed')
            """);
        jdbc.update(
                """
            INSERT INTO news_event(news_id,summary,event_start,time_precision,location_precision,sido,regions)
            VALUES('review-news','원래 요약','2025-04-08T00:00:00Z','day','none','전국','[{"sido":"전국","sigun":null,"gu":null}]')
            """);
    }

    ObjectNode submission(String type, String id) {
        return json.createObjectNode()
                .put("target_type", type)
                .put("target_id", id)
                .put("issue_type", "wording")
                .put("reason", "검증 요청");
    }

    ResultActions submit(ObjectNode input, boolean admin) throws Exception {
        return mvc.perform(
                post(admin ? "/v1/admin/reviews" : "/v1/review-requests")
                        .with(
                                user(admin ? WRITER : "approval-viewer@test.local")
                                        .roles(admin ? "ADMIN" : "VIEWER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(input.toString()));
    }

    String request(String type, String id) throws Exception {
        return json.readTree(
                        submit(submission(type, id), true)
                                .andExpect(status().isCreated())
                                .andExpect(ReviewContract.matches("Review"))
                                .andReturn()
                                .getResponse()
                                .getContentAsString())
                .path("review_id")
                .asText();
    }

    JsonNode detail(String id) throws Exception {
        return json.readTree(
                mvc.perform(get("/v1/admin/reviews/" + id).with(user(WRITER).roles("ADMIN")))
                        .andExpect(status().isOk())
                        .andExpect(ReviewContract.matches("Detail"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    ObjectNode decision(String id, String action) throws Exception {
        JsonNode d = detail(id);
        ObjectNode in =
                json.createObjectNode()
                        .put("action", action)
                        .put("scope", d.path("scope").asText())
                        .put("expected_revision", d.path("request").path("revision").longValue())
                        .put("reason", "검수 처리 사유");
        in.set("expected_value", d.path("current_value"));
        return in;
    }

    ResultActions decide(String id, ObjectNode in) throws Exception {
        return mvc.perform(
                post("/v1/admin/reviews/" + id + "/decisions")
                        .with(user(WRITER).roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(in.toString()));
    }

    int auditCount() {
        return jdbc.queryForObject("SELECT count(*) FROM review_change", Integer.class);
    }

    @Test
    void viewerReportsButOnlyAdministratorReadsAndDecides() throws Exception {
        JsonNode receipt =
                json.readTree(
                        submit(submission("news_event", "review-news"), false)
                                .andExpect(status().isCreated())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        assertThat(receipt.size()).isEqualTo(2);
        String id = receipt.path("review_id").asText();
        assertThat(detail(id).path("request").path("origin").asText()).isEqualTo("user");
        mvc.perform(get("/v1/admin/reviews")).andExpect(status().isUnauthorized());
        mvc.perform(get("/v1/admin/reviews").with(user("viewer").roles("VIEWER")))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/admin/reviews/" + id + "/decisions")
                                .with(user("viewer").roles("VIEWER"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(decision(id, "confirm").toString()))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/review-requests")
                                .with(user(WRITER).roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(submission("news_event", "review-news").toString()))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/admin/reviews")
                                .with(user("approval-disabled@test.local").roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(submission("news_event", "review-news").toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void holdRejectAndNewRequestKeepEveryDecision() throws Exception {
        String id = request("news_event", "review-news");
        decide(id, decision(id, "hold"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("on_hold"));
        decide(id, decision(id, "hold")).andExpect(status().isConflict());
        decide(id, decision(id, "reject"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("rejected"));
        decide(id, decision(id, "confirm")).andExpect(status().isConflict());
        assertThat(detail(id).path("decisions").size()).isEqualTo(2);
        String retry = request("news_event", "review-news");
        decide(retry, decision(retry, "confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("resolved"));
        assertThat(auditCount()).isEqualTo(3);
    }

    @Test
    void proposalsStayInReviewTablesAndExistingDataIsNeverChanged() throws Exception {
        ObjectNode report = submission("news_event", "review-news");
        report.putObject("proposed_value").put("place_id", "kr-12130").put("summary", "수정 제안");
        String id =
                json.readTree(
                                submit(report, true)
                                        .andExpect(status().isCreated())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .path("review_id")
                        .asText();
        JsonNode detail = detail(id);
        assertThat(detail.path("request").path("proposed_value").path("summary").asText())
                .isEqualTo("수정 제안");
        assertThat(detail.path("editable_fields").size()).isZero();
        ObjectNode correction = decision(id, "correct");
        correction.putObject("after").put("summary", "수정 시도");
        decide(id, correction).andExpect(status().isConflict());
        decide(id, decision(id, "confirm")).andExpect(status().isOk());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT summary FROM news_event WHERE news_id='review-news'",
                                String.class))
                .isEqualTo("원래 요약");
        String source = request("source", "review-source");
        ObjectNode sourceCorrection = decision(source, "correct");
        sourceCorrection.putObject("after").put("name", "수정 시도");
        decide(source, sourceCorrection).andExpect(status().isConflict());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT name FROM source WHERE source_id='review-source'",
                                String.class))
                .isEqualTo("원래 출처");
        JsonNode change = detail(id).path("decisions").get(0);
        assertThat(change.path("before_value")).isEqualTo(change.path("after_value"));
        mvc.perform(
                        get("/v1/admin/changes/" + change.path("change_id").asText())
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actor_email").value(WRITER));
    }

    @Test
    void externalImportAndOldRevisionCannotConfirmAnUnseenValue() throws Exception {
        String id = request("news_event", "review-news");
        ObjectNode stale = decision(id, "confirm");
        jdbc.update("UPDATE news_event SET summary='담당자가 적재한 새 요약' WHERE news_id='review-news'");
        decide(id, stale).andExpect(status().isConflict());
        ObjectNode fresh = decision(id, "confirm");
        fresh.put("expected_revision", 99);
        decide(id, fresh).andExpect(status().isConflict());
        assertThat(auditCount()).isZero();
        decide(id, decision(id, "confirm")).andExpect(status().isOk());
    }

    @Test
    void unsupportedDataWritesAndBulkScopesAreRejectedAtomically() throws Exception {
        String id = request("news_event", "review-news");
        for (String patch :
                new String[] {
                    "{\"news_id\":\"other\"}",
                    "{\"longitude\":0,\"latitude\":0,\"location_precision\":\"address\"}",
                    "{\"card_ids\":[\"missing\"]}"
                }) {
            ObjectNode in = decision(id, "correct");
            in.set("after", json.readTree(patch));
            decide(id, in).andExpect(status().is4xxClientError());
        }
        ObjectNode bulk = decision(id, "correct").put("scope", "global");
        bulk.putObject("after").put("summary", "잘못된 범위");
        decide(id, bulk).andExpect(status().isBadRequest());
        assertThat(auditCount()).isZero();
        assertThat(detail(id).path("request").path("revision").longValue()).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT summary FROM news_event WHERE news_id='review-news'",
                                String.class))
                .isEqualTo("원래 요약");
    }

    @Test
    void blankReasonsAndUnknownTargetsAreRejected() throws Exception {
        submit(submission("news_event", "review-news").putNull("proposed_value"), true)
                .andExpect(status().isCreated())
                .andExpect(ReviewContract.matches("Review"));
        submit(submission("news_event", "missing"), true).andExpect(status().isNotFound());
        submit(submission("raw_record", "1"), true).andExpect(status().isBadRequest());
        String id = request("news_event", "review-news");
        decide(id, decision(id, "confirm").put("reason", " ")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/admin/reviews").param("size", "101").with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        get("/v1/admin/reviews")
                                .param("status", "bogus")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cardCorrectionRequestsApprovalAndHistoryIncludesFinalVersion() throws Exception {
        String id = request("card", "C1");
        ObjectNode in =
                decision(id, "correct")
                        .put(
                                "approver_id",
                                jdbc.queryForObject(
                                        "SELECT id FROM app_user WHERE email=?",
                                        Long.class,
                                        APPROVER));
        ObjectNode edited = spec.deepCopy().put("parent_question", "검수로 수정한 질문");
        in.putObject("after").set("draft_spec", edited);
        JsonNode result =
                json.readTree(
                        decide(id, in)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("approval_pending"))
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        assertThat(cards.draft("C1").currentVersion()).isNull();
        String approval = result.path("approval_request_id").asText();
        mvc.perform(
                        post("/v1/admin/approval-requests/" + approval + "/decisions")
                                .with(user(APPROVER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":0,\"decision\":\"approve\",\"reason\":\"승인 확인\"}"))
                .andExpect(status().isOk());
        assertThat(detail(id).path("approval_status").asText()).isEqualTo("approved");
        assertThat(detail(id).path("request").path("status").asText()).isEqualTo("resolved");
        assertThat(detail(id).path("supported_actions").size()).isZero();
        mvc.perform(
                        get("/v1/admin/changes")
                                .param("target_type", "card")
                                .param("target_id", "C1")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void pendingDataPipelinesCanRegisterMetadataWithoutExposingOrModifyingRawBodies()
            throws Exception {
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES('review-spec','review-source','file','documents')");
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at) VALUES('review-run','review-spec','test',now())");
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,file_name,content_hash,payload,collected_at) VALUES('review-run','review-spec','test.csv','review-hash','{\"private_body\":\"DO_NOT_EXPOSE\"}',now())");
        Long row =
                jdbc.queryForObject(
                        "INSERT INTO normalized_record(content_hash,source_id,spec_id,validation_status,issues,rule_version,record) VALUES('review-hash','review-source','review-spec','held','[]','p2-test','{\"private_body\":\"DO_NOT_EXPOSE\"}') RETURNING id",
                        Long.class);
        String id = request("normalized_record", row.toString());
        assertThat(detail(id).toString()).doesNotContain("DO_NOT_EXPOSE");
        decide(id, decision(id, "confirm")).andExpect(status().isOk());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT record->>'private_body' FROM normalized_record WHERE id=?",
                                String.class,
                                row))
                .isEqualTo("DO_NOT_EXPOSE");
        submit(submission("press_release", "yeosu:237"), true).andExpect(status().isBadRequest());
        submit(submission("normalized_record", "invalid"), true).andExpect(status().isBadRequest());
    }

    @Test
    void listsFilterAndPaginateAndHistoryUsesExclusiveEnd() throws Exception {
        String id = request("news_event", "review-news");
        request("source", "review-source");
        decide(id, decision(id, "confirm").putNull("after")).andExpect(status().isOk());
        mvc.perform(
                        get("/v1/admin/reviews")
                                .param("status", "resolved")
                                .param("target_type", "news_event")
                                .param("q", "review-news")
                                .param("size", "1")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(
                        get("/v1/admin/changes")
                                .param("to", "2000-01-01T00:00:00Z")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }
}
