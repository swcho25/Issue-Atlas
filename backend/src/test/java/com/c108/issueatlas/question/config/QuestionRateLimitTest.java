package com.c108.issueatlas.question.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.c108.issueatlas.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "issue-atlas.questions.per-minute=1")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class QuestionRateLimitTest {
    @Autowired MockMvc mvc;

    @Test
    void countsPerIpWithinOneMinute() {
        QuestionRateLimitFilter filter = new QuestionRateLimitFilter(2, null);
        assertThat(filter.allow("a", 1)).isTrue();
        assertThat(filter.allow("a", 1)).isTrue();
        assertThat(filter.allow("a", 1)).isFalse();
        assertThat(filter.allow("b", 1)).isTrue();
        assertThat(filter.allow("a", 2)).isTrue(); // 다음 분은 새로 센다
    }

    @Test
    void overLimitIs429ProblemWithRetryAfter() throws Exception {
        // 한도 1: 첫 요청(본문이 비어 400)도 센다. 분이 바뀌는 순간에 걸려도 세 번 안에는 429 가 난다
        MockHttpServletResponse blocked = null;
        for (int i = 0; i < 3 && blocked == null; i++) {
            MockHttpServletResponse r = ask("203.0.113.7");
            if (r.getStatus() == 429) blocked = r;
        }
        assertThat(blocked).isNotNull();
        assertThat(blocked.getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        assertThat(blocked.getContentAsString()).contains("\"code\":\"TOO_MANY_REQUESTS\"");
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");

        assertThat(ask("203.0.113.8").getStatus()).isNotEqualTo(429); // 다른 IP 는 따로 센다
    }

    private MockHttpServletResponse ask(String ip) throws Exception {
        return mvc.perform(
                        post("/v1/questions")
                                .with(csrf())
                                .header("CF-Connecting-IP", ip)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andReturn()
                .getResponse();
    }
}
