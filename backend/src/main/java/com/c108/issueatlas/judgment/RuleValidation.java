package com.c108.issueatlas.judgment;

import java.util.HashSet;
import java.util.Set;
import tools.jackson.databind.JsonNode;

final class RuleValidation {
    private static final Set<String> CLAIMS =
            Set.of(
                    "observed",
                    "increasing",
                    "decreasing",
                    "unclear",
                    "insufficient",
                    "not_comparable");

    private RuleValidation() {}

    static void common(RuleType type, JsonNode rule) {
        if (rule == null
                || !rule.isObject()
                || !type.ruleId().equals(rule.path("rule_id").asText())
                || rule.path("formula_version").asText().isBlank()
                || rule.path("indicator_id").asText().isBlank()
                || !rule.path("min_years").isIntegralNumber()
                || rule.path("min_years").asInt() < 2
                || !rule.path("thresholds").isObject()
                || !rule.path("outcomes").isArray()) {
            throw new IllegalArgumentException("Invalid rule structure: " + type.ruleId());
        }
        Set<String> seen = new HashSet<>();
        JsonNode outcomes = rule.path("outcomes");
        for (JsonNode outcome : outcomes) {
            String when = outcome.path("when").asText();
            if ((!type.conditions().contains(when) && !"otherwise".equals(when))
                    || !seen.add(when)
                    || outcome.path("label").asText().isBlank()
                    || !CLAIMS.contains(outcome.path("claim").asText())) {
                throw new IllegalArgumentException("Invalid outcome: " + when);
            }
        }
        if (!seen.containsAll(type.conditions())
                || outcomes.isEmpty()
                || !"otherwise".equals(outcomes.get(outcomes.size() - 1).path("when").asText())) {
            throw new IllegalArgumentException("Missing rule outcome: " + type.ruleId());
        }
    }
}
