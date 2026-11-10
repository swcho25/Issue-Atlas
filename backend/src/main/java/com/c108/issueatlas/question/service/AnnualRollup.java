package com.c108.issueatlas.question.service;

import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.repository.QuestionRepository.ObservationRow;
import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import tools.jackson.databind.JsonNode;

/** 승인된 지표 roll 정의로 질문 기간에 완전히 포함된 해만 집계한다. */
final class AnnualRollup {
    /** 측정소가 없는(시군구 하나) 지표의 계열 이름 */
    static final String PLACE_SERIES = "_place";

    private AnnualRollup() {}

    static YearValues apply(
            List<ObservationRow> rows, JsonNode definition, LocalDate start, LocalDate end) {
        JsonNode roll = definition.path("roll");
        String method = roll.path("method").asText();
        int minMonths = roll.path("min_months").asInt(0);
        if (!List.of("sum", "mean", "end_of_period").contains(method)
                || (!"end_of_period".equals(method) && (minMonths < 1 || minMonths > 12))) {
            throw new IllegalArgumentException("Invalid approved indicator roll");
        }
        Map<String, Map<Integer, SortedMap<String, BigDecimal>>> grouped = new HashMap<>();
        for (ObservationRow row : rows) {
            if (!"available".equals(row.status()) || row.value() == null) continue;
            int year = Integer.parseInt(row.period().substring(0, 4));
            if (LocalDate.of(year, 1, 1).isBefore(start)
                    || LocalDate.of(year + 1, 1, 1).isAfter(end)) continue;
            if (!"end_of_period".equals(method) && !"M".equals(row.whenUnit())) continue;
            String series = row.stationId() == null ? PLACE_SERIES : row.stationId();
            SortedMap<String, BigDecimal> byPeriod =
                    grouped.computeIfAbsent(series, unused -> new HashMap<>())
                            .computeIfAbsent(year, unused -> new TreeMap<>());
            BigDecimal previous = byPeriod.putIfAbsent(row.period(), row.value());
            if (previous != null && previous.compareTo(row.value()) != 0) {
                throw new IllegalStateException("Conflicting observation for one period");
            }
        }
        Map<String, SortedMap<Integer, BigDecimal>> result = new HashMap<>();
        grouped.forEach(
                (series, years) -> {
                    SortedMap<Integer, BigDecimal> annual = new TreeMap<>();
                    years.forEach(
                            (year, months) -> {
                                if ("end_of_period".equals(method)) {
                                    if (!months.isEmpty())
                                        annual.put(year, months.get(months.lastKey()));
                                } else if (months.size() >= minMonths) {
                                    BigDecimal sum =
                                            months.values().stream()
                                                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                                    annual.put(
                                            year,
                                            "sum".equals(method)
                                                    ? sum
                                                    : sum.divide(
                                                            BigDecimal.valueOf(months.size()),
                                                            MathContext.DECIMAL128));
                                }
                            });
                    if (!annual.isEmpty()) result.put(series, annual);
                });
        return new YearValues(result);
    }
}
