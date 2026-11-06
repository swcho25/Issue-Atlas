package com.c108.issueatlas.question;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 내 질문(GET /v1/me/questions) · 다시 실행(POST /v1/questions/{id}/runs). 각 테스트 자료는 롤백한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyQuestionApiTest {
    private static final String PLACE = "q-mine";
    private static final String ME = "me@mine.test";
    private static final String OTHER = "other@mine.test";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() throws Exception {
        jdbc.queryForObject(
                "SELECT set_config('issue_atlas.approver', ?, true)",
                String.class,
                "admin@seed.test");
        jdbc.execute(Files.readString(Path.of("db/seed/cards-c1-a3.sql")));
        jdbc.update("INSERT INTO place(place_id,name,level) VALUES (?, '여수시', 'sigungu')", PLACE);
        jdbc.update(
                "INSERT INTO app_user(email,password_hash,name,role) VALUES"
                        + " (?,'test-only','나','VIEWER'), (?,'test-only','남','VIEWER')",
                ME,
                OTHER);
    }

    /** 질문 하나를 묻고 응답 JSON. asker 가 null 이면 로그인 없이 */
    private String ask(String asker, String card, String rawText) throws Exception {
        MockHttpServletRequestBuilder request =
                post("/v1/questions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"place_id": "%s", "card_id": %s, "period_start": "2023-01-01",
                                 "period_end": "2026-01-01", "raw_text": %s}
                                """
                                        .formatted(
                                                PLACE,
                                                card == null ? "null" : "\"" + card + "\"",
                                                rawText == null ? "null" : "\"" + rawText + "\""));
        if (asker != null) request.with(user(asker));
        return mvc.perform(request)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String mine(String asker) throws Exception {
        return mvc.perform(get("/v1/me/questions").with(user(asker)))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("my-question-list"))
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    @Test
    void 로그인해서_물은_질문만_내_질문에_뜬다() throws Exception {
        String asked = ask(ME, "C1", "여수 청년은 어디로 떠나고 있나");
        ask(OTHER, "A3", null);
        ask(null, "C1", null);

        String list = mine(ME);

        assertThat(JsonPath.<Integer>read(list, "$.questions.length()")).isEqualTo(1);
        assertThat(JsonPath.<String>read(list, "$.questions[0].question_id"))
                .isEqualTo(JsonPath.read(asked, "$.question_id"));
        assertThat(JsonPath.<String>read(list, "$.questions[0].card_name")).isEqualTo("청년 유출·정착");
        assertThat(JsonPath.<String>read(list, "$.questions[0].raw_text"))
                .isEqualTo("여수 청년은 어디로 떠나고 있나");
        assertThat(JsonPath.<String>read(list, "$.questions[0].runs[0].run_id"))
                .isEqualTo(JsonPath.read(asked, "$.run_id"));
        // 판단은 저장된 결과의 claim 그대로
        String run = JsonPath.read(asked, "$.run_id");
        assertThat(JsonPath.<String>read(list, "$.questions[0].runs[0].claim"))
                .isEqualTo(
                        jdbc.queryForObject(
                                "SELECT result -> 'claim' ->> 'value' FROM argument_run WHERE run_id = ?",
                                String.class,
                                run));
        // 로그인 없이 물은 질문은 묻는 사람이 비어 있다
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM question WHERE place_id = ? AND asked_by IS NULL",
                                Long.class,
                                PLACE))
                .isEqualTo(1);
    }

    @Test
    void 다시_실행하면_같은_질문의_새_회차가_앞에_온다() throws Exception {
        String asked = ask(ME, "C1", null);
        String questionId = JsonPath.read(asked, "$.question_id");

        String rerun =
                mvc.perform(post("/v1/questions/{id}/runs", questionId).with(user(ME)).with(csrf()))
                        .andExpect(status().isCreated())
                        .andExpect(C2Contract.matches("question-create-response"))
                        .andExpect(jsonPath("$.question_id").value(questionId))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String list = mine(ME);
        assertThat(JsonPath.<Integer>read(list, "$.questions.length()")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(list, "$.questions[0].runs.length()")).isEqualTo(2);
        assertThat(JsonPath.<String>read(list, "$.questions[0].runs[0].run_id"))
                .isEqualTo(JsonPath.read(rerun, "$.run_id"))
                .isNotEqualTo(JsonPath.read(asked, "$.run_id"));
        // 새 회차는 앞 회차를 가리킨다(재실행 로그)
        assertThat(
                        jdbc.queryForObject(
                                "SELECT previous_run_id FROM argument_run WHERE run_id = ?",
                                String.class,
                                JsonPath.<String>read(rerun, "$.run_id")))
                .isEqualTo(JsonPath.read(asked, "$.run_id"));
    }

    @Test
    void 새_이슈_후보는_candidate_로_뜬다() throws Exception {
        ask(ME, null, "여수 관광객 수");

        String list = mine(ME);

        assertThat(JsonPath.<Boolean>read(list, "$.questions[0].candidate")).isTrue();
        assertThat(JsonPath.<String>read(list, "$.questions[0].runs[0].run_status"))
                .isEqualTo("unsupported");
    }

    @Test
    void 남의_질문이나_없는_질문은_다시_실행할_수_없다() throws Exception {
        String others = JsonPath.read(ask(OTHER, "C1", null), "$.question_id");
        String anonymous = JsonPath.read(ask(null, "C1", null), "$.question_id");

        for (String id : new String[] {others, anonymous, "q_none"}) {
            mvc.perform(post("/v1/questions/{id}/runs", id).with(user(ME)).with(csrf()))
                    .andExpect(status().isNotFound());
        }
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM argument_run WHERE question_id IN (?, ?)",
                                Long.class,
                                others,
                                anonymous))
                .isEqualTo(2);
    }

    @Test
    void 로그인하지_않으면_401() throws Exception {
        String id = JsonPath.read(ask(ME, "C1", null), "$.question_id");

        mvc.perform(get("/v1/me/questions")).andExpect(status().isUnauthorized());
        mvc.perform(post("/v1/questions/{id}/runs", id).with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
