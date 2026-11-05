package com.c108.issueatlas.question;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.question.client.ArgumentEngineClient;
import com.c108.issueatlas.question.client.ArgumentEngineClient.Reply;
import com.jayway.jsonpath.JsonPath;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * 질문 실행이 engine 문장화(최대 ENGINE_TIMEOUT)를 부르는 동안 DB 트랜잭션 · 연결을 잡지 않는다(S15P31C108-254). 실제 커밋을 봐야 해서
 * 테스트 트랜잭션 없이, 이 클래스만 쓰는 DB 에서 돈다.
 */
@SpringBootTest(properties = "spring.application.name=question-transaction")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class QuestionTransactionTest {
    // 통계 없는 C1 → blocked. 진짜 engine 처럼 RUN_BLOCKED 로 건너뛴다
    private static final String SKIPPED =
            """
            {"schema_version": "ai-phrasing-result-0.2", "run_id": "x", "status": "skipped",
             "reason_code": "RUN_BLOCKED", "retryable": false, "rebuttals": [], "citations": {},
             "problems": [], "model": null, "prompt_version": "argument-phrasing-v2"}
            """;

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper json;
    @MockitoBean ArgumentEngineClient engine;

    /** engine 을 부른 순간: 트랜잭션이 있나, 풀에서 빌려 간 연결 수, 질문 행 수. */
    private record Seen(boolean transaction, int activeConnections, int questions) {}

    @Test
    void engineIsCalledWithoutTransactionOrConnectionAndRunIsSavedAfterIt() throws Exception {
        String seed = Files.readString(Path.of("db/seed/cards-c1-a3.sql"));
        tx.executeWithoutResult(
                status -> {
                    jdbc.queryForObject(
                            "SELECT set_config('issue_atlas.approver', ?, true)",
                            String.class,
                            "admin@seed.test");
                    jdbc.execute(seed);
                });
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        AtomicReference<Seen> seen = new AtomicReference<>();
        when(engine.phrase(any()))
                .thenAnswer(
                        call -> {
                            // MockMvc 는 요청을 이 스레드에서 처리하므로 트랜잭션 여부도 그 요청의 것이다
                            boolean transaction =
                                    TransactionSynchronizationManager.isActualTransactionActive();
                            int active = pool.getHikariPoolMXBean().getActiveConnections();
                            seen.set(
                                    new Seen(
                                            transaction,
                                            active,
                                            jdbc.queryForObject(
                                                    "SELECT count(*) FROM question",
                                                    Integer.class)));
                            return new Reply(json.readTree(SKIPPED), null);
                        });

        String created =
                mvc.perform(
                                post("/v1/questions")
                                        .with(user("u"))
                                        .with(csrf())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                                {"place_id": "kr-12130", "card_id": "C1",
                                                 "period_start": "2023-01-01",
                                                 "period_end": "2026-01-01", "raw_text": null}
                                                """))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String runId = JsonPath.read(created, "$.run_id");

        // 문장화 중: 트랜잭션도, 이 요청이 잡은 DB 연결도 없고 질문 · 실행 행은 아직 쓰지 않았다
        assertThat(seen.get()).isEqualTo(new Seen(false, 0, 0));
        // 문장화 뒤 짧은 트랜잭션 한 번에 질문 · 실행 · 문장화 기록을 쓴다
        assertThat(jdbc.queryForObject("SELECT count(*) FROM question", Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT p.status || ' ' || p.reason_code FROM argument_phrasing p"
                                        + " JOIN argument_run r USING (run_id) WHERE run_id = ?",
                                String.class,
                                runId))
                .isEqualTo("skipped RUN_BLOCKED");
    }
}
