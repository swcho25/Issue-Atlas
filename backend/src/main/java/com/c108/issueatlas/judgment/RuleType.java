package com.c108.issueatlas.judgment;

import java.util.Set;
import tools.jackson.databind.JsonNode;

/** 승인 규칙의 종류별 계산. 카드 ID나 저장소에 의존하지 않는다. */
public interface RuleType {
    String ruleId();

    Set<String> conditions();

    void validate(JsonNode rule);

    Evaluation evaluate(YearValues values, JsonNode rule);
}
