package com.c108.issueatlas.card;

import static com.c108.issueatlas.card.CardApprovalFixture.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.dto.CardApprovalDto.Decide;
import com.c108.issueatlas.card.dto.CardApprovalDto.Submit;
import com.c108.issueatlas.card.dto.CardStorageDto.SaveDraft;
import com.c108.issueatlas.card.service.CardApprovalService;
import com.c108.issueatlas.card.service.CardStorageService;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** 독립 연결의 실제 커밋으로 중복 요청·승인 및 요청과 초안 수정의 경합을 확인한다. */
@SpringBootTest(properties = "spring.application.name=card-approval-concurrency")
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CardApprovalConcurrencyTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired CardStorageService storage;
    @Autowired CardApprovalService approvals;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;

    List<Integer> race(Runnable first, Runnable second) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            var futures =
                    List.of(first, second).stream()
                            .map(
                                    action ->
                                            pool.submit(
                                                    (Callable<Integer>)
                                                            () -> {
                                                                ready.countDown();
                                                                if (!start.await(
                                                                        10, TimeUnit.SECONDS))
                                                                    throw new IllegalStateException(
                                                                            "start timeout");
                                                                try {
                                                                    action.run();
                                                                    return 200;
                                                                } catch (
                                                                        ErrorResponseException ex) {
                                                                    return ex.getStatusCode()
                                                                            .value();
                                                                }
                                                            }))
                            .toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(
                    futures.get(0).get(30, TimeUnit.SECONDS),
                    futures.get(1).get(30, TimeUnit.SECONDS));
        }
    }

    @Test
    void concurrentSubmitAndApproveAndDraftSaveHaveOneWinner() throws Exception {
        ObjectNode spec =
                new TransactionTemplate(transactions)
                        .execute(
                                status -> {
                                    try {
                                        return CardApprovalFixture.seed(jdbc, json, storage);
                                    } catch (Exception ex) {
                                        throw new IllegalStateException(ex);
                                    }
                                });
        long approver =
                jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, APPROVER);
        Runnable submit = () -> approvals.submit("C1", new Submit(1L, approver, "동시 요청"), WRITER);
        assertThat(race(submit, submit)).containsExactlyInAnyOrder(200, 409);
        String request =
                jdbc.queryForObject("SELECT request_id FROM card_approval_request", String.class);
        Runnable approve =
                () -> approvals.decide(request, new Decide(0L, "approve", "동시 승인"), APPROVER);
        assertThat(race(approve, approve)).containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_version", Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM card_approval_decision", Integer.class))
                .isEqualTo(1);
        storage.saveDraft("C1", new SaveDraft(1L, spec), WRITER);
        assertThat(
                        race(
                                () ->
                                        approvals.submit(
                                                "C1", new Submit(2L, approver, "새 초안 요청"), WRITER),
                                () -> storage.saveDraft("C1", new SaveDraft(2L, spec), WRITER)))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(
                        jdbc.queryForObject(
                                """
                SELECT count(*) FROM card_approval_request a JOIN card c USING(card_id)
                WHERE a.status IN ('pending','on_hold') AND a.draft_revision <> c.draft_revision
                """,
                                Integer.class))
                .isZero();
    }
}
