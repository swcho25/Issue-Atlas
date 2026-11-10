package com.c108.issueatlas.csvimport;

import static org.assertj.core.api.Assertions.*;

import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import com.c108.issueatlas.csvimport.service.CsvImportService;
import com.c108.issueatlas.csvimport.service.CsvValidator;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.ErrorResponseException;

// 별도 DB에서 실제 commit 및 두 스레드의 독립 트랜잭션을 검증한다.
@SpringBootTest(properties = "spring.application.name=csv-import-transaction-test")
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CsvImportTransactionTest {
    @Autowired CsvImportService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;

    @Test
    void simultaneousRetriesAndResultsAreSerializedAndAuditIsImmutable() throws Exception {
        String email = "csv-concurrent@test.local";
        tx.executeWithoutResult(
                s -> {
                    jdbc.update(
                            "INSERT INTO app_user(email,password_hash,name,role) VALUES (?,'test','test','ADMIN')",
                            email);
                    jdbc.update(
                            "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES ('csv-concurrent','test','test','test','metadata')");
                    jdbc.update(
                            "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES ('csv-concurrent','csv-concurrent','file','documents')");
                });
        long actor =
                jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, email);
        String place =
                jdbc.queryForObject(
                        "SELECT place_id FROM place ORDER BY place_id LIMIT 1", String.class);
        byte[] csv =
                (String.join(",", CsvValidator.COLUMNS)
                                + "\n"
                                + "document,csv-concurrent,csv-concurrent,csv-race,"
                                + place
                                + ",C1,2024-01-01T00:00:00Z,2025-01-01T00:00:00Z,,,,,문서,요약,https://example.org\n")
                        .getBytes(StandardCharsets.UTF_8);
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Request> upload =
                    () -> {
                        start.await(5, TimeUnit.SECONDS);
                        return service.upload(
                                new MockMultipartFile("file", "race.csv", "text/csv", csv),
                                "1",
                                actor,
                                "same-key",
                                email);
                    };
            var one = executor.submit(upload);
            var two = executor.submit(upload);
            start.countDown();
            Request request = one.get(20, TimeUnit.SECONDS);
            assertThat(two.get(20, TimeUnit.SECONDS).importId()).isEqualTo(request.importId());
            assertThat(request.status()).isEqualTo("pending");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM csv_import_request", Long.class))
                    .isEqualTo(1);
            CountDownLatch finish = new CountDownLatch(1);
            Callable<Integer> report =
                    () -> {
                        finish.await(5, TimeUnit.SECONDS);
                        try {
                            service.finish(
                                    request.importId(),
                                    new Finish(0L, "completed", "처리 확인", 1, 0),
                                    email);
                            return 200;
                        } catch (ErrorResponseException ex) {
                            return ex.getStatusCode().value();
                        }
                    };
            var first = executor.submit(report);
            var second = executor.submit(report);
            finish.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM csv_import_result", Long.class))
                    .isEqualTo(1);
            assertThatThrownBy(
                            () ->
                                    tx.executeWithoutResult(
                                            s -> jdbc.update("DELETE FROM csv_import_result")))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThat(service.detail(request.importId()).request().revision()).isEqualTo(1);
        }
    }
}
