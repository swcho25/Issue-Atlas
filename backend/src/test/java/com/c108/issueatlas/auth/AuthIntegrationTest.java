package com.c108.issueatlas.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.entity.Role;
import com.c108.issueatlas.user.repository.AppUserRepository;
import com.c108.issueatlas.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

/** 실제 보안 필터 체인 + PostGIS. 테스트끼리 DB 를 같이 쓰므로 계정 이메일은 테스트마다 다르게 쓴다. */
@SpringBootTest(
        properties = {
            "issue-atlas.admin.email=Admin@Atlas.test",
            "issue-atlas.admin.password=admin-pass-1234"
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthIntegrationTest {
    private static final String ADMIN = "admin@atlas.test";
    private static final String ADMIN_PASSWORD = "admin-pass-1234";

    @Autowired MockMvc mvc;
    @Autowired UserService users;
    @Autowired AppUserRepository repository;
    @Autowired ApplicationRunner initialAdminInitializer;

    @Test
    void 로그인하면_세션으로_내_정보를_본다() throws Exception {
        MockHttpSession session = login(ADMIN, ADMIN_PASSWORD);

        mvc.perform(get("/v1/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(ADMIN))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.password_hash").doesNotExist());
    }

    @Test
    void 틀린_비밀번호는_401_UNAUTHORIZED() throws Exception {
        mvc.perform(
                        post("/v1/auth/login")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(credentials(ADMIN, "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.instance").value("/v1/auth/login"));
    }

    @Test
    void 로그인_없이_API_를_부르면_401() throws Exception {
        mvc.perform(get("/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 조회자는_관리자_API_에서_403_FORBIDDEN() throws Exception {
        users.create("viewer-403@atlas.test", "viewer-pass-1", "조회자", Role.VIEWER, ADMIN);
        MockHttpSession viewer = login("viewer-403@atlas.test", "viewer-pass-1");

        mvc.perform(
                        post("/v1/admin/users")
                                .session(viewer)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(newUser("someone@atlas.test", "VIEWER")))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(repository.existsByEmail("someone@atlas.test")).isFalse();
    }

    @Test
    void 관리자가_계정을_만들면_비밀번호는_해시로만_저장된다() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);

        mvc.perform(
                        post("/v1/admin/users")
                                .session(admin)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(newUser("New.Viewer@Atlas.test", "VIEWER")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new.viewer@atlas.test"))
                .andExpect(jsonPath("$.role").value("VIEWER"))
                .andExpect(jsonPath("$.is_active").value(true))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.password_hash").doesNotExist());

        AppUser saved = repository.findByEmail("new.viewer@atlas.test").orElseThrow();
        assertThat(saved.getPasswordHash()).startsWith("{bcrypt}").doesNotContain("new-pass-1234");
    }

    @Test
    void 같은_이메일로_두_번_만들면_409() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);
        String body = newUser("dup@atlas.test", "VIEWER");
        mvc.perform(
                        post("/v1/admin/users")
                                .session(admin)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isCreated());

        mvc.perform(
                        post("/v1/admin/users")
                                .session(admin)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HTTP_ERROR"));
    }

    @Test
    void CSRF_토큰_없는_POST_는_403() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);

        mvc.perform(
                        post("/v1/admin/users")
                                .session(admin)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(newUser("no-csrf@atlas.test", "VIEWER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void 첫_관리자는_한_번만_만들어진다() throws Exception {
        initialAdminInitializer.run(null);

        assertThat(repository.findAll())
                .filteredOn(user -> user.getEmail().equals(ADMIN))
                .hasSize(1)
                .allSatisfy(user -> assertThat(user.getRole()).isEqualTo(Role.ADMIN));
    }

    @Test
    void 관리자는_자기_자신을_끌_수_없다() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);
        long adminId = repository.findByEmail(ADMIN).orElseThrow().getId();

        mvc.perform(
                        patch("/v1/admin/users/" + adminId)
                                .session(admin)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"is_active\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void 꺼진_계정은_로그인할_수_없다() throws Exception {
        AppUser off = users.create("off@atlas.test", "off-pass-1234", "끔", Role.VIEWER, ADMIN);
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);
        mvc.perform(
                        patch("/v1/admin/users/" + off.getId())
                                .session(admin)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"is_active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_active").value(false));

        mvc.perform(
                        post("/v1/auth/login")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(credentials("off@atlas.test", "off-pass-1234")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 로그인해도_허용하지_않은_경로는_403() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);

        for (String path : new String[] {"/unlisted-path", "/error"}) {
            mvc.perform(get(path).session(admin))
                    .andExpect(status().isForbidden())
                    .andExpect(
                            content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }

    @Test
    void 로그인한_사용자의_API_없는_경로는_404() throws Exception {
        MockHttpSession admin = login(ADMIN, ADMIN_PASSWORD);

        mvc.perform(get("/v1/unlisted-path").session(admin))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private MockHttpSession login(String email, String password) throws Exception {
        return (MockHttpSession)
                mvc.perform(
                                post("/v1/auth/login")
                                        .with(csrf())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(credentials(email, password)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getRequest()
                        .getSession(false);
    }

    private static String credentials(String email, String password) {
        return "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
    }

    private static String newUser(String email, String role) {
        return "{\"email\":\"%s\",\"password\":\"new-pass-1234\",\"name\":\"새 계정\",\"role\":\"%s\"}"
                .formatted(email, role);
    }
}
