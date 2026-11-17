package com.c108.issueatlas.question;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.transaction.annotation.Transactional;

/** 관리자 새 이슈 후보 목록(GET /v1/admin/question-candidates, S15P31C108-345). 각 테스트 자료는 롤백한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AdminQuestionCandidateApiTest {
    private static final String PATH = "/v1/admin/question-candidates";
    private static final Path CONTRACT = Path.of("../contracts/question-candidates");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        jdbc.update(
                "INSERT INTO place(place_id,name,level) VALUES"
                        + " ('qc-yeosu','여수시','sigungu'), ('qc-donggu','광주 동구','sigungu')");
        jdbc.update(
                "INSERT INTO app_user(email,password_hash,name,role) VALUES"
                        + " ('asker@qc.test','test-only','묻는 사람','VIEWER')");
        long asker =
                jdbc.queryForObject(
                        "SELECT id FROM app_user WHERE email='asker@qc.test'", Long.class);
        question(
                "q-qc-old",
                "qc-yeosu",
                null,
                "여수 청년 주거비 부담은 어떤가요?\n이슈 이름: 청년 주거비 부담",
                null,
                "2026-11-09T09:00:00+09:00");
        question(
                "q-qc-new",
                "qc-yeosu",
                null,
                "2024년 여수 관광객 수는 어떻게 변했나\n이슈 이름: 관광객 수\n궁금한 까닭: 축제 뒤 방문객",
                asker,
                "2026-11-11T14:00:00+09:00");
        question("q-qc-blank", "qc-donggu", null, null, null, "2026-11-10T09:00:00+09:00");
        // 카드가 있는 질문은 후보가 아니다
        question("q-qc-card", "qc-yeosu", "C1", "여수 청년 유출", asker, "2026-11-11T15:00:00+09:00");
    }

    private void question(
            String id, String place, String card, String raw, Long asker, String createdAt) {
        jdbc.update(
                "INSERT INTO question(question_id,place_id,card_id,period_start,period_end,raw_text,asked_by,created_at)"
                        + " VALUES (?,?,?,DATE '2024-01-01',DATE '2025-01-01',?,?,?)",
                id,
                place,
                card,
                raw,
                asker,
                OffsetDateTime.parse(createdAt));
    }

    private ResultActions admin(String url) throws Exception {
        return mvc.perform(get(url).with(user("admin@qc.test").roles("ADMIN")));
    }

    @Test
    void 카드_없는_질문만_접수_최신_순으로_나눈_칸과_함께_준다() throws Exception {
        admin(PATH + "?place_id=qc-yeosu")
                .andExpect(status().isOk())
                .andExpect(matchesContract())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].question_id").value("q-qc-new"))
                .andExpect(jsonPath("$.items[0].place_name").value("여수시"))
                .andExpect(jsonPath("$.items[0].period_start").value("2024-01-01"))
                .andExpect(jsonPath("$.items[0].period_end").value("2025-01-01"))
                .andExpect(jsonPath("$.items[0].issue_name").value("관광객 수"))
                .andExpect(jsonPath("$.items[0].reason").value("축제 뒤 방문객"))
                .andExpect(jsonPath("$.items[0].sentence").value("2024년 여수 관광객 수는 어떻게 변했나"))
                .andExpect(jsonPath("$.items[0].asked_by.name").value("묻는 사람"))
                .andExpect(jsonPath("$.items[0].asked_by.email").value("asker@qc.test"))
                .andExpect(jsonPath("$.items[1].question_id").value("q-qc-old"))
                .andExpect(jsonPath("$.items[1].issue_name").value("청년 주거비 부담"))
                .andExpect(jsonPath("$.items[1].reason").isEmpty())
                .andExpect(jsonPath("$.items[1].asked_by").isEmpty());
    }

    @Test
    void 지역을_거르지_않으면_모든_후보를_세고_카드_있는_질문은_빠진다() throws Exception {
        long candidates =
                jdbc.queryForObject(
                        "SELECT count(*) FROM question WHERE card_id IS NULL", Long.class);
        String body =
                admin(PATH + "?size=100")
                        .andExpect(status().isOk())
                        .andExpect(matchesContract())
                        .andExpect(jsonPath("$.total").value(candidates))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("q-qc-blank").doesNotContain("q-qc-card");
        // 원문이 없는 후보는 나눈 칸도 모두 null
        admin(PATH + "?place_id=qc-donggu")
                .andExpect(jsonPath("$.items[0].raw_text").isEmpty())
                .andExpect(jsonPath("$.items[0].issue_name").isEmpty())
                .andExpect(jsonPath("$.items[0].sentence").isEmpty());
    }

    @Test
    void 쪽을_넘기고_없는_지역은_빈_목록() throws Exception {
        admin(PATH + "?place_id=qc-yeosu&page=2&size=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].question_id").value("q-qc-old"));
        admin(PATH + "?place_id=qc-nowhere")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void 관리자만_보고_잘못된_쿼리는_400() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(get(PATH).with(user("viewer").roles("VIEWER")))
                .andExpect(status().isForbidden());
        for (List<String> query :
                List.of(
                        List.of("page", "0"),
                        List.of("size", "0"),
                        List.of("size", "101"),
                        List.of("place_id", ""),
                        List.of("place_id", "kr-\u0001"),
                        List.of("place_id", "x".repeat(201)))) {
            mvc.perform(
                            get(PATH)
                                    .param(query.get(0), query.get(1))
                                    .with(user("admin@qc.test").roles("ADMIN")))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
    }

    @Test
    void 계약_예시가_계약_스키마를_지킨다() throws Exception {
        JsonNode example =
                new ObjectMapper()
                        .readTree(
                                CONTRACT.resolve("examples/question-candidate-page.json").toFile());
        assertThat(validate(example)).isEmpty();
    }

    private static ResultMatcher matchesContract() {
        return result ->
                assertThat(
                                validate(
                                        new ObjectMapper()
                                                .readTree(
                                                        result.getResponse()
                                                                .getContentAsString(
                                                                        StandardCharsets.UTF_8))))
                        .as("question-candidates response")
                        .isEmpty();
    }

    private static java.util.Set<?> validate(JsonNode body) throws Exception {
        var json = new ObjectMapper();
        var doc = json.readTree(CONTRACT.resolve("openapi.json").toFile());
        var schema =
                json.createObjectNode().put("$ref", "#/components/schemas/QuestionCandidatePage");
        schema.set("components", doc.get("components"));
        return JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                .getSchema(
                        schema,
                        SchemaValidatorsConfig.builder().formatAssertionsEnabled(true).build())
                .validate(body);
    }
}
