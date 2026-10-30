package com.c108.issueatlas.source;

import static org.hamcrest.Matchers.contains;
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

/** 가상 출처 둘: a(등급 A, 명세 둘 — 성공 · 실패가 섞인 것과 한 번도 성공 못 한 것), b(등급 없음, 명세 없음). 테스트마다 되돌린다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SourceApiTest {
    private static final String A = "$.sources[?(@.source_id == 'S-src-a')]";
    private static final String B = "$.sources[?(@.source_id == 'S-src-b')]";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S-src-a','가상 통계','가상청','KOGL-1','full','A'),"
                        + " ('S-src-b','가상 게시판','가상시','KOGL-4','metadata',NULL)");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES"
                        + " ('SP-src-1','S-src-a','api','statistics'),"
                        + " ('SP-src-2','S-src-a','file','denominators')");
        run("src-r1", "SP-src-1", "2026-10-01 10:00+09", "ok");
        run("src-r2", "SP-src-1", "2026-10-02 10:00+09", "ok");
        run("src-r3", "SP-src-1", "2026-10-03 10:00+09", "failed");
        run("src-r4", "SP-src-2", "2026-10-04 10:00+09", "failed");
    }

    @Test
    @WithMockUser
    void 출처마다_등급_이용조건과_명세별_마지막_성공() throws Exception {
        mvc.perform(get("/v1/sources"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schema_version").value("c2-0.1"))
                .andExpect(jsonPath(A + ".source_grade").value(contains("A")))
                .andExpect(jsonPath(A + ".license_type").value(contains("KOGL-1")))
                .andExpect(
                        jsonPath(A + ".specs[*].spec_id").value(contains("SP-src-1", "SP-src-2")))
                .andExpect(
                        jsonPath(A + ".specs[*].evidence_kind")
                                .value(contains("statistics", "denominators")))
                // 실패한 실행은 세지 않는다. 마지막 성공은 10/02 실행의 종료 시각(10:01 한국)
                .andExpect(
                        jsonPath(A + ".specs[0].last_success_at")
                                .value(contains("2026-10-02T01:01:00Z")))
                .andExpect(jsonPath(A + ".specs[1].last_success_at").value(contains((Object) null)))
                .andExpect(jsonPath(B + ".source_grade").value(contains((Object) null)))
                .andExpect(jsonPath(B + ".storage_scope").value(contains("metadata")))
                .andExpect(jsonPath(B + ".specs[*]").isEmpty());
    }

    @Test
    void 로그인_없이는_401() throws Exception {
        mvc.perform(get("/v1/sources")).andExpect(status().isUnauthorized());
    }

    private void run(String id, String spec, String startedAt, String status) {
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at,finished_at,status)"
                        + " VALUES (?,?,'test-0.1',CAST(? AS timestamptz),"
                        + " CAST(? AS timestamptz) + interval '1 minute',?)",
                id,
                spec,
                startedAt,
                startedAt,
                status);
    }
}
