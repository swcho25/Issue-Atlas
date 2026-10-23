package com.c108.issueatlas.common.exception;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;

// 오류 응답 모양만 본다. 보안 필터는 웹 슬라이스에 자동으로 붙으므로 로그인 사용자와 CSRF 토큰을 채워 둔다.
@WebMvcTest(ApiExceptionHandlerTest.ProbeController.class)
@Import({ApiExceptionHandler.class, ApiExceptionHandlerTest.ProbeController.class})
@WithMockUser
class ApiExceptionHandlerTest {
    private final MockMvc mvc;

    ApiExceptionHandlerTest(@Autowired MockMvc mvc) {
        this.mvc = mvc;
    }

    @Test
    void invalidBodyHasFieldErrors() throws Exception {
        mvc.perform(
                        post("/__test/errors/body")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("urn:issue-atlas:error:invalid-request"))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.detail").value("요청 형식이나 값을 확인해 주세요."))
                .andExpect(jsonPath("$.instance").value("/__test/errors/body"))
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].message").value("이름은 필수입니다."))
                .andExpect(jsonPath("$.errors[0].rejectedValue").doesNotExist());
    }

    @Test
    void malformedJsonIsBadRequest() throws Exception {
        mvc.perform(
                        post("/__test/errors/body")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{secret-invalid-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString("secret-invalid-json"))));
    }

    @Test
    void missingBodyIsBadRequest() throws Exception {
        mvc.perform(
                        post("/__test/errors/body")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void invalidQueryTypeIsBadRequest() throws Exception {
        mvc.perform(get("/__test/errors/query").param("count", "invalid-secret"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString("invalid-secret"))));
    }

    @Test
    void missingQueryIsBadRequest() throws Exception {
        mvc.perform(get("/__test/errors/query"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void missingResourceIsNotFound() throws Exception {
        mvc.perform(get("/__test/errors/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.errors").isEmpty());
    }

    @Test
    void unknownPathIsNotFound() throws Exception {
        mvc.perform(get("/__test/errors/unknown"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void methodNotAllowedPreservesStatusAndHeader() throws Exception {
        mvc.perform(get("/__test/errors/body"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", containsString("POST")))
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.code").value("HTTP_ERROR"));
    }

    @Test
    void unexpectedErrorDoesNotExposeInternalsOrQuery() throws Exception {
        mvc.perform(get("/__test/errors/fail").queryParam("key", "secret-query"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.detail").value("서버에서 요청을 처리하지 못했습니다."))
                .andExpect(jsonPath("$.instance").value("/__test/errors/fail"))
                .andExpect(jsonPath("$.trace").doesNotExist())
                .andExpect(content().string(not(containsString("secret-query"))))
                .andExpect(content().string(not(containsString("secret-database"))))
                .andExpect(content().string(not(containsString("IllegalStateException"))));
    }

    @Test
    void successfulResponseIsUnchanged() throws Exception {
        mvc.perform(get("/__test/errors/ok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("ok"))
                .andExpect(jsonPath("$.code").doesNotExist());
    }

    @RestController
    @RequestMapping("/__test/errors")
    public static class ProbeController {
        @PostMapping("/body")
        public Map<String, String> body(@Valid @RequestBody Input input) {
            return Map.of("name", input.name());
        }

        @GetMapping("/query")
        public Map<String, Integer> query(@RequestParam int count) {
            return Map.of("count", count);
        }

        @GetMapping("/missing")
        public void missing() {
            throw new ResourceNotFoundException();
        }

        @GetMapping("/fail")
        public void fail() {
            throw new IllegalStateException("secret-database");
        }

        @GetMapping("/ok")
        public Map<String, String> ok() {
            return Map.of("result", "ok");
        }
    }

    public record Input(@NotBlank(message = "이름은 필수입니다.") String name) {}
}
