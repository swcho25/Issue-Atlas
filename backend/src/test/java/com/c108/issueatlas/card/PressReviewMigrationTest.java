package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.Map;
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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PressReviewMigrationTest {
    private static final String ACTOR = "press-review@test.local";
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    long actor;
    JsonNode original;
    String migration;

    @BeforeEach
    void seed() throws Exception {
        migration =
                Files.readString(
                        Path.of(
                                "src/main/resources/db/migration/V0043__use_normalized_press_reviews.sql"));
        // 새 DB에는 V0043까지 적용됐으므로, 이전 검수 요청을 넣을 때만 V0037 제약을 재현한다.
        jdbc.execute("ALTER TABLE review_request DROP CONSTRAINT review_request_target_type_check");
        jdbc.execute(
                "ALTER TABLE review_request ADD CONSTRAINT review_request_target_type_check CHECK(target_type IN ('news_event','normalized_record','press_release','source','card'))");
        actor =
                jdbc.queryForObject(
                        "INSERT INTO app_user(email,password_hash,name,role,is_active) VALUES(?,'test-only','검수자','ADMIN',true) RETURNING id",
                        Long.class,
                        ACTOR);
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES('press_yeosu','보도자료','여수시','KOGL-4','metadata') ON CONFLICT DO NOTHING");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES('press-review-spec','press_yeosu','board','documents')");
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at) VALUES('press-review-run','press-review-spec','test',now())");
        original =
                json.readTree(
                        """
            {"press_id":"yeosu:237","title":"원래 제목","category":"청년","department":"청년부서",
             "published_on":"2025-04-08","url":"https://example.org/237","site":"yeosu"}
            """);
    }

    long normalized(String press, String hash, String title, boolean latest) {
        var payload = json.createObjectNode();
        payload.put("press_id", press)
                .put("title", title)
                .put("category", "청년")
                .put("department", "청년부서")
                .put("published_on", "2025-04-08")
                .put("url", "https://example.org/237")
                .put("private_body", "PRIVATE_BODY");
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,payload,collected_at) VALUES('press-review-run','press-review-spec','https://example.org',?,?::jsonb,now())",
                hash,
                payload.toString());
        var record = json.createObjectNode();
        record.putObject("locator").put("press_id", press);
        record.putObject("document")
                .put("kind", "press_release")
                .put("title", title)
                .put("publisher", "여수시")
                .put("link", "https://example.org/237")
                .put("body", "PRIVATE_BODY")
                .putArray("categories")
                .add("청년");
        record.put("published_at", "2025-04-08T00:00:00+09:00")
                .put("collected_at", "2025-04-08T01:00:00+09:00")
                .put("license_type", "KOGL-4");
        return jdbc.queryForObject(
                """
            INSERT INTO normalized_record(content_hash,source_id,spec_id,place_code_system,place_code_raw,
              observed_period_type,storage_scope,validation_status,issues,rule_version,obs_key,is_latest,record)
            VALUES(?,'press_yeosu','press-review-spec','kosis','46130','point','metadata','pass','[]','p2-test',?, ?,?::jsonb) RETURNING id
            """,
                Long.class,
                hash,
                "obs:" + "a".repeat(64),
                latest,
                record.toString());
    }

    void legacy(String id, String press) {
        jdbc.update(
                """
            INSERT INTO review_request(review_id,origin,target_type,target_id,issue_type,reason,submitted_value,
              proposed_value,submitted_by,status,revision,created_at)
            VALUES(?,'admin','press_release',?,'wording','검수 사유',?::jsonb,'{"title":"제안 제목"}',?,'on_hold',3,'2026-11-01T00:00:00Z')
            """,
                id,
                press,
                original.toString(),
                actor);
        jdbc.update(
                """
            INSERT INTO review_change(change_id,review_id,action,scope,actor_id,reason,before_value,after_value,revision)
            VALUES(?,?,'hold','record',?,'보류 사유',?::jsonb,?::jsonb,3)
            """,
                "change-" + id,
                id,
                actor,
                original.toString(),
                original.toString());
    }

    JsonNode detail(String id) throws Exception {
        return json.readTree(
                mvc.perform(get("/v1/admin/reviews/" + id).with(user(ACTOR).roles("ADMIN")))
                        .andExpect(status().isOk())
                        .andExpect(ReviewContract.matches("Detail"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    @Test
    void oldReviewAndAuditSurviveMigrationAndOldTableRemoval() throws Exception {
        long exact = normalized("yeosu:237", "press-exact", "원래 제목", false);
        normalized("yeosu:237", "press-new", "새 제목", true);
        legacy("legacy-press", "yeosu:237");
        jdbc.execute(migration);
        jdbc.execute("DROP TABLE press_release");
        JsonNode d = detail("legacy-press");
        assertThat(d.path("request").path("target_type").asText()).isEqualTo("normalized_record");
        assertThat(d.path("request").path("target_id").asText()).isEqualTo(Long.toString(exact));
        assertThat(d.path("request").path("revision").longValue()).isEqualTo(4);
        assertThat(d.path("request").path("status").asText()).isEqualTo("on_hold");
        assertThat(d.path("request").path("submitted_value")).isEqualTo(original);
        assertThat(d.path("request").path("proposed_value").path("title").asText())
                .isEqualTo("제안 제목");
        assertThat(d.path("decisions").get(0).path("before_value")).isEqualTo(original);
        assertThat(d.path("current_value").path("document").path("title").asText())
                .isEqualTo("원래 제목");
        assertThat(d.path("current_value").path("department").asText()).isEqualTo("청년부서");
        assertThat(d.toString()).doesNotContain("PRIVATE_BODY");
        var decision =
                json.createObjectNode()
                        .put("expected_revision", 3)
                        .put("action", "confirm")
                        .put("scope", "record")
                        .put("reason", "확인");
        decision.set("expected_value", d.path("current_value"));
        mvc.perform(
                        post("/v1/admin/reviews/legacy-press/decisions")
                                .with(user(ACTOR).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(decision.toString()))
                .andExpect(status().isConflict());
        decision.put("expected_revision", 4);
        mvc.perform(
                        post("/v1/admin/reviews/legacy-press/decisions")
                                .with(user(ACTOR).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(decision.toString()))
                .andExpect(status().isOk());
        mvc.perform(
                        get("/v1/admin/changes")
                                .param("target_type", "normalized_record")
                                .param("target_id", Long.toString(exact))
                                .with(user(ACTOR).roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void newPressCanBeReviewedWithoutLegacyTable() throws Exception {
        long id = normalized("yeosu:238", "new-only", "새 수집 보도자료", true);
        jdbc.execute(migration);
        jdbc.execute("DROP TABLE press_release");
        String request =
                json.writeValueAsString(
                        Map.of(
                                "target_type",
                                "normalized_record",
                                "target_id",
                                Long.toString(id),
                                "issue_type",
                                "metadata",
                                "reason",
                                "새 자료 검수"));
        JsonNode result =
                json.readTree(
                        mvc.perform(
                                        post("/v1/admin/reviews")
                                                .with(user(ACTOR).roles("ADMIN"))
                                                .with(csrf())
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(request))
                                .andExpect(status().isCreated())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        assertThat(
                        detail(result.path("review_id").asText())
                                .path("current_value")
                                .path("document")
                                .path("title")
                                .asText())
                .isEqualTo("새 수집 보도자료");
        mvc.perform(
                        post("/v1/admin/reviews")
                                .with(user(ACTOR).roles("ADMIN"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request.replace("normalized_record", "press_release")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void latestNormalizedVersionIsUsedWhenSubmittedSnapshotHasNoExactMatch() {
        normalized("yeosu:237", "press-older", "정제된 이전 제목", false);
        long latest = normalized("yeosu:237", "press-latest", "정제된 새 제목", true);
        legacy("fallback-press", "yeosu:237");
        jdbc.execute(migration);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT target_id FROM review_request WHERE review_id='fallback-press'",
                                String.class))
                .isEqualTo(Long.toString(latest));
    }

    @Test
    void missingHandoffFailsBeforeChangingRequestsOrAudit() {
        legacy("unmatched-press", "yeosu:missing");
        jdbc.execute(
                (ConnectionCallback<Void>)
                        connection -> {
                            var savepoint = connection.setSavepoint();
                            try (var statement = connection.createStatement()) {
                                assertThatThrownBy(() -> statement.execute(migration))
                                        .isInstanceOf(SQLException.class)
                                        .hasMessageContaining("complete data handoff first");
                            } finally {
                                connection.rollback(savepoint);
                            }
                            return null;
                        });
        assertThat(
                        jdbc.queryForObject(
                                "SELECT target_type FROM review_request WHERE review_id='unmatched-press'",
                                String.class))
                .isEqualTo("press_release");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM review_change WHERE review_id='unmatched-press'",
                                Integer.class))
                .isEqualTo(1);
    }
}
