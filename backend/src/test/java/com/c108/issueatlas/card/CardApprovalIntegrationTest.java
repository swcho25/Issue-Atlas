package com.c108.issueatlas.card;

import static com.c108.issueatlas.card.CardApprovalFixture.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.dto.CardStorageDto.SaveDraft;
import com.c108.issueatlas.card.service.CardStorageService;
import java.sql.Savepoint;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CardApprovalIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CardStorageService storage;
    ObjectNode spec;

    @BeforeEach
    void seed() throws Exception {
        spec = CardApprovalFixture.seed(jdbc, json, storage);
    }

    long id(String email) {
        return jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, email);
    }

    ResultActions submit(String approver) throws Exception {
        return mvc.perform(
                post("/v1/admin/cards/C1/approval-requests")
                        .with(user(WRITER).roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"expected_revision\":1,\"approver_id\":"
                                        + id(approver)
                                        + ",\"reason\":\"검토 요청\"}"));
    }

    String request() throws Exception {
        return json.readTree(
                        submit(APPROVER)
                                .andExpect(status().isCreated())
                                .andExpect(C3Contract.matches("ApprovalRequest"))
                                .andReturn()
                                .getResponse()
                                .getContentAsString())
                .path("request_id")
                .asText();
    }

    ResultActions decide(String request, String email, long revision, String action)
            throws Exception {
        return mvc.perform(
                post("/v1/admin/approval-requests/" + request + "/decisions")
                        .with(user(email).roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"expected_revision\":"
                                        + revision
                                        + ",\"decision\":\""
                                        + action
                                        + "\",\"reason\":\"검토 결과\"}"));
    }

    int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    @Test
    void requestsListDetailAndDesignatedApprovalPreserveOldVersion() throws Exception {
        String request = request();
        mvc.perform(
                        get("/v1/admin/approval-requests")
                                .with(user(WRITER).roles("ADMIN"))
                                .param("approver_id", Long.toString(id(APPROVER)))
                                .param("status", "pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(C3Contract.matches("ApprovalPage"));
        mvc.perform(
                        get("/v1/admin/approval-requests/" + request)
                                .with(user(APPROVER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft_spec.author").value(WRITER))
                .andExpect(jsonPath("$.request.requested_by").value(id(WRITER)))
                .andExpect(C3Contract.matches("ApprovalDetail"));
        decide(request, OTHER, 0, "approve").andExpect(status().isForbidden());
        assertThat(count("card_version")).isZero();
        decide(request, APPROVER, 0, "approve")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("approved"))
                .andExpect(jsonPath("$.approved_version").value(2));
        assertThat(count("card_version")).isEqualTo(1);
        assertThat(count("card_revision")).isEqualTo(1);
        assertThat(count("card_approval_decision")).isEqualTo(1);
        decide(request, APPROVER, 1, "approve").andExpect(status().isConflict());
        storage.saveDraft("C1", new SaveDraft(1L, spec.deepCopy().put("name", "수정된 이름")), WRITER);
        mvc.perform(
                        post("/v1/admin/cards/C1/approval-requests")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":2,\"approver_id\":"
                                                + id(APPROVER)
                                                + ",\"reason\":\"새 버전 요청\"}"))
                .andExpect(status().isCreated());
        assertThat(storage.version("C1", 2).spec().path("name").asText())
                .isEqualTo(spec.path("name").asText());
        assertThat(storage.draft("C1").currentVersion()).isEqualTo(2);
    }

    @Test
    void selfApprovalWorksThroughExistingRouteButDirectBypassDoesNot() throws Exception {
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":1,\"reason\":\"요청 없음\"}"))
                .andExpect(status().isConflict());
        submit(WRITER).andExpect(status().isCreated());
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user(OTHER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":1,\"reason\":\"대신 승인\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/admin/cards/C1/approvals")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"expected_revision\":1,\"reason\":\"자기 승인\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.approved_by").value(WRITER))
                .andExpect(C3Contract.matches("Version"));
        submit(WRITER).andExpect(status().isConflict());
    }

    @Test
    void holdThenRejectAllowsEditAndNewRequest() throws Exception {
        String request = request();
        decide(request, APPROVER, 0, "hold")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("on_hold"));
        decide(request, APPROVER, 0, "reject").andExpect(status().isConflict());
        decide(request, APPROVER, 1, "reject")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("rejected"));
        storage.saveDraft("C1", new SaveDraft(1L, spec), WRITER);
        mvc.perform(
                        post("/v1/admin/cards/C1/approval-requests")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":2,\"approver_id\":"
                                                + id(APPROVER)
                                                + ",\"reason\":\"수정 후 재요청\"}"))
                .andExpect(status().isCreated());
        assertThat(count("card_approval_request")).isEqualTo(2);
        assertThat(count("card_approval_decision")).isEqualTo(2);
    }

    @Test
    void heldRequestCanBeApproved() throws Exception {
        String request = request();
        decide(request, APPROVER, 0, "hold").andExpect(status().isOk());
        decide(request, APPROVER, 1, "approve")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approved_version").value(2));
        assertThat(count("card_approval_decision")).isEqualTo(2);
    }

    @Test
    void openRequestLocksDraftAndRejectsDuplicateRequests() throws Exception {
        request();
        submit(APPROVER).andExpect(status().isConflict());
        ObjectNode input = json.createObjectNode().put("expected_revision", 1);
        input.set("spec", spec);
        mvc.perform(
                        put("/v1/admin/cards/C1/draft")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input.toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void inactiveAndViewerApproversAreRejectedAndDirectoryOmitsThem() throws Exception {
        submit("approval-viewer@test.local").andExpect(status().isBadRequest());
        submit("approval-disabled@test.local").andExpect(status().isBadRequest());
        mvc.perform(get("/v1/admin/users").with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[0].password_hash").doesNotExist())
                .andExpect(C3Contract.matches("AdminUserPage"));
        mvc.perform(
                        get("/v1/admin/users")
                                .param("role", "VIEWER")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isBadRequest());
        String request = request();
        jdbc.update("UPDATE app_user SET is_active=false WHERE email=?", APPROVER);
        decide(request, APPROVER, 0, "approve").andExpect(status().isForbidden());
        assertThat(count("card_version")).isZero();
    }

    @Test
    void changedRuleRequiresRejectAndResubmitInsteadOfSilentApproval() throws Exception {
        String request = request();
        jdbc.update(
                "UPDATE indicator SET definition=jsonb_set(definition,'{label}','\"변경됨\"') WHERE indicator_id='population_net_migration_19_39'");
        decide(request, APPROVER, 0, "approve").andExpect(status().isConflict());
        assertThat(count("card_version")).isZero();
        assertThat(count("card_approval_decision")).isZero();
        decide(request, APPROVER, 0, "reject").andExpect(status().isOk());
        submit(APPROVER).andExpect(status().isCreated());
    }

    @Test
    void invalidDraftAndMissingOrStaleTargetsDoNotCreateRequests() throws Exception {
        mvc.perform(get("/v1/admin/approval-requests/absent").with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isNotFound());
        mvc.perform(
                        get("/v1/admin/approval-requests")
                                .param("status", "bad")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        get("/v1/admin/approval-requests")
                                .param("page", "0")
                                .with(user(WRITER).roles("ADMIN")))
                .andExpect(status().isBadRequest());
        storage.saveDraft(
                "C1", new SaveDraft(1L, spec.deepCopy().put("claim_template", "규칙 없는 문장")), WRITER);
        submit(APPROVER).andExpect(status().isConflict());
        mvc.perform(
                        post("/v1/admin/cards/C1/approval-requests")
                                .with(user(WRITER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":2,\"approver_id\":"
                                                + id(APPROVER)
                                                + ",\"reason\":\"검사 실패\"}"))
                .andExpect(status().isBadRequest());
        assertThat(count("card_approval_request")).isZero();
    }

    @Test
    void newPathsRequireAdminAndCsrfAndReasons() throws Exception {
        String request = request();
        for (String path :
                List.of(
                        "/v1/admin/users",
                        "/v1/admin/approval-requests",
                        "/v1/admin/approval-requests/" + request)) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(user("viewer").roles("VIEWER")))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(
                        post("/v1/admin/approval-requests/" + request + "/decisions")
                                .with(user(APPROVER).roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":0,\"decision\":\"approve\",\"reason\":\"검사\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/v1/admin/approval-requests/" + request + "/decisions")
                                .with(user(APPROVER).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expected_revision\":0,\"decision\":\"reject\",\"reason\":\" \"}"))
                .andExpect(status().isBadRequest());
        assertThat(count("card_approval_decision")).isZero();
    }

    @Test
    void failedApprovalRollsBackVersionAndDecisionTogether() throws Exception {
        String request = request();
        jdbc.execute(
                "CREATE FUNCTION fail_approval_205() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced' USING ERRCODE='23514'; END $$");
        jdbc.execute(
                "CREATE TRIGGER fail_approval_205 BEFORE UPDATE ON card FOR EACH ROW EXECUTE FUNCTION fail_approval_205()");
        jdbc.execute(
                (ConnectionCallback<Void>)
                        connection -> {
                            Savepoint point = connection.setSavepoint();
                            try {
                                decide(request, APPROVER, 0, "approve")
                                        .andExpect(status().isBadRequest());
                            } catch (Exception ex) {
                                throw new IllegalStateException(ex);
                            } finally {
                                connection.rollback(point);
                                connection.releaseSavepoint(point);
                            }
                            return null;
                        });
        assertThat(count("card_version")).isZero();
        assertThat(count("card_revision")).isZero();
        assertThat(count("card_approval_decision")).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM card_approval_request WHERE request_id=?",
                                String.class,
                                request))
                .isEqualTo("pending");
    }
}
