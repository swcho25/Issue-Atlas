package com.c108.issueatlas.judgment;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class FirstLastDiff implements RuleType {
    private static final Set<String> CONDITIONS =
            Set.of(
                    "fewer_than_min_years",
                    "no_common_station",
                    "diff_at_least_worse",
                    "diff_at_most_better");

    @Override
    public String ruleId() {
        return "first_last_diff";
    }

    @Override
    public Set<String> conditions() {
        return CONDITIONS;
    }

    @Override
    public void validate(JsonNode rule) {
        RuleValidation.common(this, rule);
        JsonNode thresholds = rule.path("thresholds");
        if (!thresholds.path("worse").isNumber()
                || !thresholds.path("better").isNumber()
                || decimal(thresholds.path("better")).compareTo(decimal(thresholds.path("worse")))
                        >= 0) {
            throw new IllegalArgumentException("Invalid first-last thresholds");
        }
    }

    @Override
    public Evaluation evaluate(YearValues values, JsonNode rule) {
        validate(rule);
        SortedMap<Integer, Set<String>> stationsByYear = new TreeMap<>();
        values.bySeries()
                .forEach(
                        (station, years) ->
                                years.keySet()
                                        .forEach(
                                                y ->
                                                        stationsByYear
                                                                .computeIfAbsent(
                                                                        y,
                                                                        unused -> new HashSet<>())
                                                                .add(station)));
        int yearCount = stationsByYear.size();
        if (yearCount < rule.path("min_years").asInt()) {
            return new Evaluation(
                    Set.of("fewer_than_min_years"),
                    false,
                    Map.of("yearCount", yearCount, "commonStationCount", 0));
        }
        Set<String> common = new HashSet<>(stationsByYear.get(stationsByYear.firstKey()));
        stationsByYear.values().forEach(common::retainAll);
        if (common.isEmpty()) {
            return new Evaluation(
                    Set.of("no_common_station"),
                    false,
                    Map.of("yearCount", yearCount, "commonStationCount", 0));
        }
        int first = stationsByYear.firstKey();
        int last = stationsByYear.lastKey();
        BigDecimal diff =
                average(values.bySeries(), common, last)
                        .subtract(average(values.bySeries(), common, first));
        Set<String> holds =
                diff.compareTo(decimal(rule.path("thresholds").path("worse"))) >= 0
                        ? Set.of("diff_at_least_worse")
                        : diff.compareTo(decimal(rule.path("thresholds").path("better"))) <= 0
                                ? Set.of("diff_at_most_better")
                                : Set.of();
        return new Evaluation(
                holds,
                true,
                Map.of(
                        "yearCount",
                        yearCount,
                        "commonStationCount",
                        common.size(),
                        "difference",
                        diff));
    }

    private static BigDecimal average(
            Map<String, SortedMap<Integer, BigDecimal>> values, Set<String> stations, int year) {
        BigDecimal sum =
                stations.stream()
                        .map(station -> values.get(station).get(year))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(stations.size()), MathContext.DECIMAL128);
    }

    private static BigDecimal decimal(JsonNode value) {
        return new BigDecimal(value.asText());
    }
}
