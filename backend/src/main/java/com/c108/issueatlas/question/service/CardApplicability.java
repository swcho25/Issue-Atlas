package com.c108.issueatlas.question.service;

import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.dto.ArgumentResponse.Applicability;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;
import tools.jackson.databind.JsonNode;

/**
 * 카드 적용 조건(양식 B6)을 조건마다 확인한다(C2 argument.applicability). 하나라도 못 채우면 실행은 unsupported.
 *
 * <p>승인본은 jsonb 라 칸 순서가 남지 않는다. 줄 순서는 카드 계약(card.schema.json)의 칸 순서이고, 모르는 칸은 뒤에 확인하지 못함(null)으로
 * 둔다.
 */
final class CardApplicability {
    static final String PLACE_LEVEL = "place_level";
    private static final List<String> ORDER =
            List.of(PLACE_LEVEL, "min_complete_years", "min_stations", "population");
    private static final Map<String, String> LEVELS =
            Map.of("sido", "시도", "sigungu", "시군구", "emd", "읍면동", "station", "측정소");

    private CardApplicability() {}

    /**
     * values: 판정에 쓴 연 값. null 이면 판정 전에 멈춘 실행이라 연 값 · 측정소 조건은 확인하지 못함(note = unchecked). 지역 단위는 늘
     * 확인한다.
     */
    static List<Applicability> check(
            JsonNode conditions,
            String placeName,
            String placeLevel,
            YearValues values,
            String unchecked) {
        List<String> names = new ArrayList<>();
        ORDER.stream().filter(conditions::has).forEach(names::add);
        conditions.propertyNames().stream().filter(n -> !names.contains(n)).forEach(names::add);
        List<Applicability> rows = new ArrayList<>();
        for (String name : names) {
            JsonNode value = conditions.path(name);
            rows.add(
                    switch (name) {
                        case PLACE_LEVEL ->
                                new Applicability(
                                        name,
                                        levelName(value.asText()) + " 단위",
                                        value.asText().equals(placeLevel),
                                        placeName + "(" + levelName(placeLevel) + ")");
                        case "min_complete_years" -> years(name, value.asInt(), values, unchecked);
                        case "min_stations" -> stations(name, value.asInt(), values, unchecked);
                        case "population" ->
                                new Applicability(name, "대상: " + value.asText(), null, null);
                        default -> new Applicability(name, name, null, null);
                    });
        }
        return List.copyOf(rows);
    }

    static String levelName(String level) {
        return LEVELS.getOrDefault(level, level);
    }

    private static Applicability years(
            String name, int minimum, YearValues values, String unchecked) {
        String label = "완전한 연 값 " + minimum + "개 이상";
        if (values == null) return new Applicability(name, label, null, unchecked);
        SortedSet<Integer> years = new TreeSet<>();
        values.bySeries().values().forEach(series -> years.addAll(series.keySet()));
        return new Applicability(name, label, years.size() >= minimum, yearsNote(years));
    }

    /**
     * 연 값 수와 해. 이어지면 「3개(2023–2025)」, 빠진 해가 있으면 「2개(2023 · 2025)」, 하나면 「1개(2025)」. 화면은 ✕ 목록에 그대로
     * 쓰므로 빠진 해를 이어진 기간처럼 쓰지 않는다.
     */
    static String yearsNote(SortedSet<Integer> years) {
        if (years.isEmpty()) return "0개";
        boolean contiguous = years.last() - years.first() + 1 == years.size();
        String span =
                years.size() == 1
                        ? String.valueOf(years.first())
                        : contiguous
                                ? years.first() + "–" + years.last()
                                : String.join(" · ", years.stream().map(String::valueOf).toList());
        return years.size() + "개(" + span + ")";
    }

    private static Applicability stations(
            String name, int minimum, YearValues values, String unchecked) {
        String label = "측정소 " + minimum + "곳 이상";
        if (values == null) return new Applicability(name, label, null, unchecked);
        int count = values.bySeries().size();
        return new Applicability(name, label, count >= minimum, "측정소 " + count + "곳");
    }
}
