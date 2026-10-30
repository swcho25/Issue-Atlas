package com.c108.issueatlas.job;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 가상 수집 실행 4건: a 소스 성공 · 실패, b 소스 실행 중 · 건수 없는 성공. 다른 테스트 데이터와 섞이지 않게 소스로 거르고, 테스트마다 되돌린다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AdminJobApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES"
                        + " ('S-job-a','가상 통계','기관','KOGL-1','full'),"
                        + " ('S-job-b','가상 파일','기관','KOGL-1','full')");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES"
                        + " ('SP-job-a','S-job-a','api','statistics'),"
                        + " ('SP-job-b','S-job-b','file','statistics')");
        run(
                "job-r1",
                "SP-job-a",
                "2026-10-01 10:00+09",
                "ok",
                "{\"received\": 648, \"inserted\": 648, \"duplicates\": 0, \"start\": 2023}");
        run(
                "job-r2",
                "SP-job-a",
                "2026-10-02 10:00+09",
                "failed",
                "{\"received\": 0, \"inserted\": 0, \"duplicates\": 0, \"error_code\": \"KOSIS_HTTP_ERROR\"}");
        run("job-r3", "SP-job-b", "2026-10-03 10:00+09", null, "{\"file_name\": \"2023.zip\"}");
        run("job-r4", "SP-job-b", "2026-10-04 10:00+09", "ok", "{\"file_name\": \"2024.xlsx\"}");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 수집_대상으로_거르고_최근_시작_순() throws Exception {
        mvc.perform(get("/v1/admin/jobs").param("source_id", "S-job-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schema_version").value("c2-0.1"))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.jobs[*].job_run_id").value(contains("job-r2", "job-r1")))
                .andExpect(jsonPath("$.jobs[0].status").value("failed"))
                .andExpect(jsonPath("$.jobs[0].error_code").value("KOSIS_HTTP_ERROR"))
                .andExpect(jsonPath("$.jobs[1].source_name").value("가상 통계"))
                .andExpect(jsonPath("$.jobs[1].method").value("api"))
                .andExpect(jsonPath("$.jobs[1].received").value(648))
                .andExpect(jsonPath("$.jobs[1].error_code").value(nullValue()))
                .andExpect(jsonPath("$.jobs[1].details.start").value(2023));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 상태_필터와_페이지() throws Exception {
        // 끝나지 않은 실행은 running, 종료 시각 없음
        mvc.perform(get("/v1/admin/jobs").param("status", "running").param("spec_id", "SP-job-b"))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.jobs[0].job_run_id").value("job-r3"))
                .andExpect(jsonPath("$.jobs[0].finished_at").value(nullValue()));
        // b 소스 2건 중 2쪽(쪽당 1건) → 오래된 r3. 건수가 없는 실행은 null
        mvc.perform(
                        get("/v1/admin/jobs")
                                .param("source_id", "S-job-b")
                                .param("size", "1")
                                .param("page", "2"))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.jobs[*].job_run_id").value(contains("job-r3")));
        mvc.perform(get("/v1/admin/jobs").param("source_id", "S-job-b").param("size", "1"))
                .andExpect(jsonPath("$.jobs[0].job_run_id").value("job-r4"))
                .andExpect(jsonPath("$.jobs[0].received").value(nullValue()))
                .andExpect(jsonPath("$.jobs[0].details.file_name").value("2024.xlsx"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 실행_한_건과_잘못된_요청() throws Exception {
        mvc.perform(get("/v1/admin/jobs/job-r2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job.spec_id").value("SP-job-a"))
                .andExpect(jsonPath("$.job.error_code").value("KOSIS_HTTP_ERROR"));
        mvc.perform(get("/v1/admin/jobs/job-none")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/admin/jobs").param("status", "done"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v1/admin/jobs").param("page", "0")).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/admin/jobs").param("size", "101")).andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "VIEWER")
    void 조회자는_403() throws Exception {
        mvc.perform(get("/v1/admin/jobs")).andExpect(status().isForbidden());
    }

    @Test
    void 로그인_없이는_401() throws Exception {
        mvc.perform(get("/v1/admin/jobs")).andExpect(status().isUnauthorized());
    }

    private void run(String id, String spec, String startedAt, String status, String stats) {
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at,finished_at,status,stats)"
                        + " VALUES (?,?,'test-0.1',CAST(? AS timestamptz),"
                        + " CASE WHEN CAST(? AS text) IS NULL THEN NULL"
                        + " ELSE CAST(? AS timestamptz) + interval '1 minute' END,"
                        + " ?,CAST(? AS jsonb))",
                id,
                spec,
                startedAt,
                status,
                startedAt,
                status,
                stats);
    }
}
