package com.c108.issueatlas.question.service;

import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.repository.QuestionRepository.ObservationRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.SortedMap;
import tools.jackson.databind.JsonNode;

/**
 * 근거 상세 「이 질문에 쓴 값」(evidence.display) 의 통계 · 분모 문장(S15P31C108-320). 판정과 같은 연 값(AnnualRollup)을 그대로
 * 옮기고, 질문 기간 안인데 롤업에서 빠진 해는 「제외(N개월)」로 적는다. 예: {@code 여수시 · 청년(19–39세) 순이동 · 연 합계(명): 2023 제외(11개월)
 * · 2024 −1,935 · 2025 −2,262}. 측정소가 여럿이면 측정소마다 「 / 」로 잇는다.
 */
final class EvidenceDisplay {
    private static final char MINUS = '−';

    private EvidenceDisplay() {}

    /** 값이 하나도 없으면(관측 행 없음) null */
    static String annual(
            String placeName,
            JsonNode definition,
            List<ObservationRow> rows,
            YearValues values,
            Map<String, String> stationNames,
            LocalDate start,
            LocalDate end) {
        String method = definition.path("roll").path("method").asText();
        Map<String, Map<Integer, Integer>> months = new HashMap<>();
        for (ObservationRow row : rows) {
            if (!"available".equals(row.status()) || row.value() == null) continue;
            if (!"end_of_period".equals(method) && !"M".equals(row.whenUnit())) continue;
            String series = row.stationId() == null ? AnnualRollup.PLACE_SERIES : row.stationId();
            int year = Integer.parseInt(row.period().substring(0, 4));
            months.computeIfAbsent(series, unused -> new HashMap<>()).merge(year, 1, Integer::sum);
        }
        List<Integer> years = new ArrayList<>();
        // 질문 기간에 통째로 들어가는 해만(AnnualRollup 과 같은 규칙)
        for (int y = start.getYear(); y <= end.getYear(); y++) {
            if (!LocalDate.of(y, 1, 1).isBefore(start) && !LocalDate.of(y + 1, 1, 1).isAfter(end)) {
                years.add(y);
            }
        }
        List<String> series = new ArrayList<>(months.keySet());
        values.bySeries().keySet().stream().filter(s -> !series.contains(s)).forEach(series::add);
        if (series.isEmpty() || years.isEmpty()) return null;
        series.sort(
                Comparator.comparing((String s) -> !AnnualRollup.PLACE_SERIES.equals(s))
                        .thenComparing(s -> stationNames.getOrDefault(s, s)));
        List<String> lines = new ArrayList<>();
        for (String s : series) {
            SortedMap<Integer, BigDecimal> annual = values.bySeries().get(s);
            Map<Integer, Integer> counted = months.getOrDefault(s, Map.of());
            List<String> parts = new ArrayList<>();
            for (int year : years) {
                if (annual != null && annual.containsKey(year)) {
                    parts.add(year + " " + number(annual.get(year), method));
                } else if (counted.containsKey(year)) {
                    parts.add(
                            year
                                    + ("end_of_period".equals(method)
                                            ? " 제외"
                                            : " 제외(" + counted.get(year) + "개월)"));
                } else {
                    parts.add(year + " 자료 없음");
                }
            }
            String body = String.join(" · ", parts);
            lines.add(
                    AnnualRollup.PLACE_SERIES.equals(s)
                            ? body
                            : stationNames.getOrDefault(s, s) + " " + body);
        }
        String unit = definition.path("unit").asText("");
        String head =
                String.join(
                        " · ",
                        placeName,
                        definition.path("label").asText(),
                        rollWord(method) + (unit.isBlank() ? "" : "(" + unit + ")"));
        return head + ": " + String.join(" / ", lines);
    }

    private static String rollWord(String method) {
        return switch (method) {
            case "sum" -> "연 합계";
            case "mean" -> "연평균";
            default -> "연말";
        };
    }

    /** 천 단위 쉼표, 음수는 − (U+2212). 평균은 소수 한 자리, 나머지는 있는 자리(최대 둘)까지 */
    static String number(BigDecimal value, String method) {
        DecimalFormat format =
                new DecimalFormat(
                        "mean".equals(method) ? "#,##0.0" : "#,##0.##",
                        DecimalFormatSymbols.getInstance(Locale.ROOT));
        format.setRoundingMode(RoundingMode.HALF_UP);
        return format.format(value).replace('-', MINUS);
    }
}
