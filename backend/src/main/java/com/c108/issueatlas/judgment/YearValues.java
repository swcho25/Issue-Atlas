package com.c108.issueatlas.judgment;

import java.math.BigDecimal;
import java.util.Map;
import java.util.SortedMap;

/** 시군구 지표는 계열 하나, 측정소 지표는 측정소마다 하나의 연 값 계열. */
public record YearValues(Map<String, SortedMap<Integer, BigDecimal>> bySeries) {}
