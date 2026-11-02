package com.c108.issueatlas.judgment;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class NetMigrationTrend implements RuleType {
    private static final Set<String> CONDITIONS =
            Set.of(
                    "fewer_than_min_years",
                    "all_negative_abs_increasing",
                    "all_negative_abs_decreasing",
                    "turned_positive");

    @Override
    public String ruleId() {
        return "net_migration_trend";
    }

    @Override
    public Set<String> conditions() {
        return CONDITIONS;
    }

    @Override
    public void validate(JsonNode rule) {
        RuleValidation.common(this, rule);
        if (rule.path("thresholds").size() != 0) {
            throw new IllegalArgumentException("Net migration has no thresholds");
        }
    }

    @Override
    public Evaluation evaluate(YearValues values, JsonNode rule) {
        validate(rule);
        if (values.bySeries().size() != 1) {
            throw new IllegalArgumentException("Net migration requires one series");
        }
        List<BigDecimal> years =
                new ArrayList<>(values.bySeries().values().iterator().next().values());
        int minimum = rule.path("min_years").asInt();
        if (years.size() < minimum) {
            return new Evaluation(
                    Set.of("fewer_than_min_years"), true, Map.of("yearCount", years.size()));
        }
        boolean negative = years.stream().allMatch(value -> value.signum() < 0);
        boolean widening = true;
        boolean narrowing = true;
        for (int i = 1; i < years.size(); i++) {
            int comparison = years.get(i).abs().compareTo(years.get(i - 1).abs());
            widening &= comparison > 0;
            narrowing &= comparison < 0;
        }
        if (negative && widening) {
            return new Evaluation(
                    Set.of("all_negative_abs_increasing"), true, Map.of("yearCount", years.size()));
        }
        if (negative && narrowing) {
            return new Evaluation(
                    Set.of("all_negative_abs_decreasing"), true, Map.of("yearCount", years.size()));
        }
        boolean earlierOutflow =
                years.subList(0, years.size() - 1).stream().anyMatch(value -> value.signum() < 0);
        if (earlierOutflow && years.getLast().signum() > 0) {
            return new Evaluation(
                    Set.of("turned_positive"), true, Map.of("yearCount", years.size()));
        }
        return new Evaluation(Set.of(), true, Map.of("yearCount", years.size()));
    }
}
