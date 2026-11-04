package com.c108.issueatlas.judgment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

class RuleTypeTest {
    private final ObjectMapper json = new ObjectMapper();
    private final NetMigrationTrend migration = new NetMigrationTrend();
    private final FirstLastDiff difference = new FirstLastDiff();

    private JsonNode rule(String card) throws Exception {
        return json.readTree(Files.readString(Path.of("../contracts/cards/" + card + ".json")))
                .path("rule");
    }

    private static SortedMap<Integer, BigDecimal> years(int start, String... values) {
        SortedMap<Integer, BigDecimal> result = new TreeMap<>();
        for (int i = 0; i < values.length; i++) result.put(start + i, new BigDecimal(values[i]));
        return result;
    }

    @Test
    void c1UsesApprovedConditionsAndSkipsZeroOrAllPositive() throws Exception {
        JsonNode rule = rule("C1");
        migration.validate(rule);
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of("place", years(2023, "-100", "-200"))),
                                        rule)
                                .holds())
                .containsExactly("fewer_than_min_years");
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of(
                                                        "place",
                                                        years(2023, "-100", "-200", "-300"))),
                                        rule)
                                .holds())
                .containsExactly("all_negative_abs_increasing");
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of(
                                                        "place",
                                                        years(2023, "-300", "-200", "-100"))),
                                        rule)
                                .holds())
                .containsExactly("all_negative_abs_decreasing");
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of("place", years(2023, "-300", "-200", "50"))),
                                        rule)
                                .holds())
                .containsExactly("turned_positive");
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of("place", years(2023, "10", "20", "30"))),
                                        rule)
                                .holds())
                .isEmpty();
        assertThat(
                        migration
                                .evaluate(
                                        new YearValues(
                                                Map.of("place", years(2023, "-30", "-20", "0"))),
                                        rule)
                                .holds())
                .isEmpty();
    }

    @Test
    void a3UsesOnlyStationsPresentInEveryValidYear() throws Exception {
        JsonNode rule = rule("A3");
        difference.validate(rule);
        YearValues values =
                new YearValues(
                        Map.of(
                                "common", years(2023, "10", "11", "13"),
                                "late", years(2024, "100", "100")));
        Evaluation result = difference.evaluate(values, rule);
        assertThat(result.holds()).containsExactly("diff_at_least_worse");
        assertThat(result.sameBoundary()).isTrue();
        assertThat(result.facts()).containsEntry("commonStationCount", 1);
        assertThat(result.facts()).containsEntry("difference", new BigDecimal("3"));
        // 문장화가 그대로 쓰는 시군구 연 값: 공통 측정소의 첫해 · 끝해 평균
        assertThat(result.facts())
                .containsEntry("firstYear", 2023)
                .containsEntry("firstMean", new BigDecimal("10"))
                .containsEntry("lastYear", 2025)
                .containsEntry("lastMean", new BigDecimal("13"));

        Evaluation better =
                difference.evaluate(
                        new YearValues(Map.of("one", years(2023, "13", "11", "10"))), rule);
        assertThat(better.holds()).containsExactly("diff_at_most_better");
    }

    @Test
    void a3SeparatesInsufficientYearsFromNoCommonStation() throws Exception {
        JsonNode rule = rule("A3");
        Evaluation few =
                difference.evaluate(new YearValues(Map.of("one", years(2023, "10", "11"))), rule);
        assertThat(few.holds()).containsExactly("fewer_than_min_years");

        Evaluation disjoint =
                difference.evaluate(
                        new YearValues(
                                Map.of(
                                        "old", years(2023, "10", "11"),
                                        "new", years(2025, "13"))),
                        rule);
        assertThat(disjoint.holds()).containsExactly("no_common_station");
        assertThat(disjoint.sameBoundary()).isFalse();
    }

    @Test
    void invalidConditionOrThresholdIsRejectedBeforeApproval() throws Exception {
        ObjectNode c1 = (ObjectNode) rule("C1").deepCopy();
        ((ObjectNode) c1.path("outcomes").get(1)).put("when", "unknown");
        assertThatThrownBy(() -> migration.validate(c1))
                .isInstanceOf(IllegalArgumentException.class);

        ObjectNode a3 = (ObjectNode) rule("A3").deepCopy();
        ((ObjectNode) a3.path("thresholds")).remove("worse");
        assertThatThrownBy(() -> difference.validate(a3))
                .isInstanceOf(IllegalArgumentException.class);

        ObjectNode badClaim = (ObjectNode) rule("A3").deepCopy();
        ((ObjectNode) badClaim.path("outcomes").get(1)).put("claim", "worse");
        assertThatThrownBy(() -> difference.validate(badClaim))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
