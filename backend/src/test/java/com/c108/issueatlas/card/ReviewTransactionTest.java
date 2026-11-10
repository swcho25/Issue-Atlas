package com.c108.issueatlas.card;

import static com.c108.issueatlas.card.CardApprovalFixture.*;
import static org.assertj.core.api.Assertions.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.service.CardStorageService;
import com.c108.issueatlas.review.dto.ReviewDto.*;
import com.c108.issueatlas.review.service.ReviewService;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

// 독립 컨테이너와 실제 commit을 사용한다. 테스트 전체를 감싸는 rollback 트랜잭션은 사용하지 않는다.
@SpringBootTest(properties = "spring.application.name=review-transaction-test")
@Import(TestcontainersConfiguration.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ReviewTransactionTest {
    @Autowired ReviewService reviews;
    @Autowired CardStorageService cards;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    ObjectNode spec;

    @BeforeAll
    void seed() {
        tx.executeWithoutResult(
                status -> {
                    try {
                        spec = CardApprovalFixture.seed(jdbc, json, cards);
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                    jdbc.update(
                            "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES('review-concurrent','출처','기관','test','metadata')");
                });
    }

    @Test
    void invalidCardApprovalRollsBackDraftAndAuditInCommittedDatabase() {
        Request r =
                reviews.submit(
                        new Submit("card", "C1", "classification", null, "카드 검수", null),
                        WRITER,
                        true);
        var before = reviews.detail(r.reviewId()).currentValue();
        ObjectNode invalid = spec.deepCopy();
        invalid.remove("claim_items");
        ObjectNode after = json.createObjectNode();
        after.set("draft_spec", invalid);
        long approver =
                jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, APPROVER);
        assertThatThrownBy(
                        () ->
                                reviews.decide(
                                        r.reviewId(),
                                        new Decide(
                                                0L, "correct", "card", "검증", before, after,
                                                approver),
                                        WRITER))
                .isInstanceOf(ErrorResponseException.class);
        assertThat(reviews.detail(r.reviewId()).currentValue()).isEqualTo(before);
        assertThat(reviews.get(r.reviewId()).revision()).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM review_change WHERE review_id=?",
                                Integer.class,
                                r.reviewId()))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_approval_request", Integer.class))
                .isZero();
    }

    @Test
    void twoRealTransactionsCanOnlyResolveOnceAndAuditIsAppendOnly() throws Exception {
        Request r =
                reviews.submit(
                        new Submit("source", "review-concurrent", "metadata", null, "동시 검수", null),
                        WRITER,
                        true);
        var before = reviews.detail(r.reviewId()).currentValue();
        Decide input = new Decide(0L, "confirm", "source", "확인", before, null, null);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> run =
                    () -> {
                        start.await();
                        try {
                            reviews.decide(r.reviewId(), input, WRITER);
                            return 200;
                        } catch (ErrorResponseException ex) {
                            return ex.getStatusCode().value();
                        }
                    };
            var a = pool.submit(run);
            var b = pool.submit(run);
            start.countDown();
            assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(reviews.detail(r.reviewId()).decisions()).hasSize(1);
        assertThat(reviews.detail(r.reviewId()).currentValue()).isEqualTo(before);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE review_change SET reason='변조' WHERE review_id=?",
                                        r.reviewId()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "DELETE FROM review_change WHERE review_id=?",
                                        r.reviewId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
