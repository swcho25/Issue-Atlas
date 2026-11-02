package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** 실제 두 연결이 각각 커밋한다. 승인 이력이 남으므로 독립 테스트 DB/컨텍스트를 쓴다. */
@SpringBootTest(properties = "spring.application.name=card-storage-concurrency")
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CardStorageConcurrencyTest {
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    @Test
    void simultaneousDraftWritesAndApprovalsHaveExactlyOneWinner() throws Exception {
        ObjectNode spec =
                (ObjectNode)
                        json.readTree(
                                Files.readString(
                                        Path.of("../contracts/c3/examples/c1-draft.json")));
        spec.set(
                "claim_items",
                json.createArrayNode()
                        .add(
                                json.createObjectNode()
                                        .put("indicator_id", "race_indicator")
                                        .put("role", "main")));
        jdbc.update(
                """
                INSERT INTO indicator(indicator_id,definition,rule,added_by_card,updated_by)
                VALUES ('race_indicator',
                  '{"id":"race_indicator","label":"테스트","unit":"명","target":"청년 15–39세",
                    "period_type":"M","place_level":"sigungu","roll":{"method":"sum","min_months":12},"source":{}}',
                  '{"rule_id":"test","formula_version":"test-1","thresholds":{},"outcomes":[{"when":"otherwise","label":"불분명","claim":"unclear"}]}',
                  'C1','test')
                """);
        jdbc.update("UPDATE card SET draft_spec=?::jsonb WHERE card_id='C1'", spec.toString());
        assertThat(race(false)).containsExactlyInAnyOrder("1", "0");
        assertThat(race(true)).containsExactlyInAnyOrder("2", "40001");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_version", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_revision", Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT current_version FROM card WHERE card_id='C1'",
                                Integer.class))
                .isEqualTo(2);
    }

    List<String> race(boolean approval) throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        Callable<String> task =
                () -> {
                    try (var connection = dataSource.getConnection();
                            var statement = connection.createStatement()) {
                        connection.setAutoCommit(false);
                        statement.setQueryTimeout(15);
                        ready.countDown();
                        if (!start.await(10, TimeUnit.SECONDS))
                            throw new IllegalStateException("race start timeout");
                        try {
                            String result;
                            if (approval) {
                                try (var row =
                                        statement.executeQuery(
                                                "SELECT approve_card('C1','race',1,'동시 승인')")) {
                                    row.next();
                                    result = row.getString(1);
                                }
                            } else {
                                result =
                                        Integer.toString(
                                                statement.executeUpdate(
                                                        "UPDATE card SET draft_revision=draft_revision+1 WHERE card_id='C1' AND draft_revision=0"));
                            }
                            connection.commit();
                            return result;
                        } catch (SQLException ex) {
                            connection.rollback();
                            return ex.getSQLState();
                        }
                    }
                };
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(task);
            var second = executor.submit(task);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
        }
    }
}
