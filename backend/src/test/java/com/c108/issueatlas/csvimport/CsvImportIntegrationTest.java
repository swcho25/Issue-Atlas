package com.c108.issueatlas.csvimport;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.csvimport.service.CsvValidator;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CsvImportIntegrationTest {
    static final String ADMIN = "csv-admin@test.local", ASSIGNEE = "csv-assignee@test.local";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    long assignee;
    String source, spec, place;

    @BeforeEach
    void seed() {
        for (String email : new String[] {ADMIN, ASSIGNEE})
            jdbc.update(
                    "INSERT INTO app_user(email,password_hash,name,role) VALUES (?,'test-only',?,'ADMIN')",
                    email,
                    email);
        assignee =
                jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, ASSIGNEE);
        source = "csv-source";
        spec = "csv-spec";
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES (?,'test','test','test','full')",
                source);
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES (?,?,'file','statistics')",
                spec,
                source);
        place =
                jdbc.queryForObject(
                        "SELECT place_id FROM place ORDER BY place_id LIMIT 1", String.class);
        jdbc.update(
                """
                INSERT INTO indicator(indicator_id,definition,updated_by) VALUES ('csv-test',
                '{"id":"csv-test","label":"검증용","unit":"명","period_type":"Y",
                  "place_level":"sigungu","roll":{"method":"end_of_period"},"source":{}}','test')
                """);
    }

    String row(String key) {
        return "indicator,"
                + source
                + ","
                + spec
                + ","
                + key
                + ","
                + place
                + ",C1,2024-01-01T00:00:00Z,2025-01-01T00:00:00Z,csv-test,12,명,,,,";
    }

    String csv(String... rows) {
        return "\uFEFF"
                + String.join(",", CsvValidator.COLUMNS)
                + "\r\n"
                + String.join("\r\n", rows)
                + "\r\n";
    }

    ResultActions upload(String contents, String key) throws Exception {
        return upload(contents.getBytes(StandardCharsets.UTF_8), key, assignee, ADMIN, true);
    }

    ResultActions upload(byte[] bytes, String key, long assigned, String actor, boolean token)
            throws Exception {
        var request =
                multipart("/v1/admin/imports")
                        .file(new MockMultipartFile("file", "../자료.csv", "text/csv", bytes))
                        .param("template_version", "1")
                        .param("assignee_id", Long.toString(assigned))
                        .param("request_key", key)
                        .with(user(actor).roles(actor.equals("viewer") ? "VIEWER" : "ADMIN"));
        if (token) request.with(csrf());
        return mvc.perform(request);
    }

    JsonNode created(String contents, String key) throws Exception {
        return json.readTree(
                upload(contents, key)
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    ResultActions finish(
            String id, String actor, long revision, String state, int loaded, int skipped)
            throws Exception {
        return mvc.perform(
                post("/v1/admin/imports/" + id + "/results")
                        .with(user(actor).roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                    {"expected_revision":%d,"status":"%s","reason":"담당자가 별도로 확인한 결과", "loaded_rows":%d,"skipped_rows":%d}
                    """
                                        .formatted(revision, state, loaded, skipped)));
    }

    @Test
    void validFileIsPreservedAndOnlyAssignedAdminCanFinishWithoutBusinessWrites() throws Exception {
        long before = jdbc.queryForObject("SELECT count(*) FROM normalized_record", Long.class);
        String content = csv(row("csv-one"));
        var request = created(content, "one");
        String id = request.path("import_id").asText();
        assertThat(request.path("status").asText()).isEqualTo("pending");
        assertThat(request.path("file_name").asText()).isEqualTo("자료.csv");
        assertThat(request.path("validation").path("eligible_rows").asInt()).isEqualTo(1);
        mvc.perform(get("/v1/admin/imports/" + id + "/file").with(user(ADMIN).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(content.getBytes(StandardCharsets.UTF_8)));
        finish(id, ADMIN, 0, "completed", 1, 0).andExpect(status().isForbidden());
        finish(id, ASSIGNEE, 1, "completed", 1, 0).andExpect(status().isConflict());
        finish(id, ASSIGNEE, 0, "completed", 0, 0).andExpect(status().isBadRequest());
        finish(id, ASSIGNEE, 0, "completed", 1, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.request.status").value("completed"))
                .andExpect(jsonPath("$.request.revision").value(1));
        finish(id, ASSIGNEE, 1, "failed", 0, 0).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM normalized_record", Long.class))
                .isEqualTo(before);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM csv_import_result WHERE import_id=?",
                                Long.class,
                                id))
                .isEqualTo(1);
    }

    @Test
    void invalidRowBlocksWholeFileAndCannotBeCompleted() throws Exception {
        var request =
                created(csv(row("good"), row("bad").replace(place, "unknown-place")), "invalid");
        assertThat(request.path("status").asText()).isEqualTo("validation_failed");
        assertThat(request.path("validation").path("valid_rows").asInt()).isEqualTo(1);
        finish(request.path("import_id").asText(), ASSIGNEE, 0, "completed", 1, 0)
                .andExpect(status().isConflict());
    }

    @Test
    void duplicatesAreCountedAgainstDatabaseAndWithinFile() throws Exception {
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at) VALUES ('csv-job',?,'test',now())",
                spec);
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,file_name,content_hash,payload,collected_at) VALUES ('csv-job',?,'test.csv','csv-hash','{}',now())",
                spec);
        jdbc.update(
                "INSERT INTO normalized_record(content_hash,dedup_key,source_id,spec_id,record,validation_status,issues,rule_version) VALUES ('csv-hash','csv-existing',?,?,'{}','held','[]','p2-test')",
                source,
                spec);
        var request =
                created(csv(row("csv-existing"), row("csv-new"), row("csv-new")), "duplicates");
        assertThat(request.path("validation").path("duplicate_rows").asInt()).isEqualTo(2);
        assertThat(request.path("validation").path("eligible_rows").asInt()).isEqualTo(1);
        var all = created(csv(row("csv-existing")), "all-duplicates");
        assertThat(all.path("status").asText()).isEqualTo("no_changes");
    }

    @Test
    void requestKeyReplayDoesNotCreateAnotherRequestAndDifferentPayloadConflicts()
            throws Exception {
        var first = created(csv(row("first")), "replay");
        var second = created(csv(row("first")), "replay");
        assertThat(second.path("import_id")).isEqualTo(first.path("import_id"));
        upload(csv(row("different")), "replay").andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM csv_import_request", Long.class))
                .isEqualTo(1);
    }

    @Test
    void authenticationCsrfAndActiveAssigneeAreRequired() throws Exception {
        mvc.perform(get("/v1/admin/imports")).andExpect(status().isUnauthorized());
        byte[] bytes = csv(row("secure")).getBytes(StandardCharsets.UTF_8);
        upload(bytes, "csrf", assignee, ADMIN, false).andExpect(status().isForbidden());
        upload(bytes, "viewer", assignee, "viewer", true).andExpect(status().isForbidden());
        jdbc.update("UPDATE app_user SET is_active=false WHERE id=?", assignee);
        upload(bytes, "inactive", assignee, ADMIN, true).andExpect(status().isBadRequest());
        jdbc.update("UPDATE app_user SET is_active=false WHERE email=?", ADMIN);
        upload(bytes, "inactive-actor", assignee, ADMIN, true).andExpect(status().isForbidden());
    }

    @Test
    void templateFilteringAndFailedProcessingAreSupported() throws Exception {
        mvc.perform(
                        get("/v1/admin/import-templates/normalized-record/file")
                                .with(user(ADMIN).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(
                        content()
                                .bytes(
                                        ("\uFEFF" + String.join(",", CsvValidator.COLUMNS) + "\r\n")
                                                .getBytes(StandardCharsets.UTF_8)));
        var request = created(csv(row("failure")), "failure");
        String id = request.path("import_id").asText();
        finish(id, ASSIGNEE, 0, "failed", 0, 0).andExpect(status().isOk());
        mvc.perform(
                        get("/v1/admin/imports")
                                .param("status", "failed")
                                .param("assignee_id", "" + assignee)
                                .with(user(ADMIN).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/v1/admin/imports").param("size", "101").with(user(ADMIN).roles("ADMIN")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v1/admin/imports/missing").with(user(ADMIN).roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void sizeLimitsMalformedFilesAndRequiredResultFieldsAreEnforced() throws Exception {
        upload(new byte[CsvValidator.MAX_BYTES + 1], "large", assignee, ADMIN, true)
                .andExpect(status().isPayloadTooLarge());
        var invalid = created("wrong,header\n", "malformed");
        assertThat(invalid.path("status").asText()).isEqualTo("validation_failed");
        assertThat(invalid.path("validation").path("errors").path(0).path("code").asText())
                .isEqualTo("header_mismatch");
        var valid = created(csv(row("required")), "required");
        mvc.perform(
                        post("/v1/admin/imports/" + valid.path("import_id").asText() + "/results")
                                .with(user(ASSIGNEE).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"status\":\"completed\",\"reason\":\"보고\"}"))
                .andExpect(status().isBadRequest());
    }
}
