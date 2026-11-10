package com.c108.issueatlas.judgment;

import java.util.Map;
import java.util.Set;

/** 맞는 조건과 계산 사실. 결과 순서·문구는 승인본의 outcomes가 결정한다. */
public record Evaluation(Set<String> holds, boolean sameBoundary, Map<String, Object> facts) {}
