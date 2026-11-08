package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.dto.ArgumentResponse.Applicability;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 카드 적용 조건(B6) 줄: 순서 · 판정 전 null · 연 값 note 형식(C2 v1, S15P31C108-283). */
class CardApplicabilityTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode conditions(String json) {
        return JSON.readTree(json);
    }

    private static YearValues values(Map<String, List<Integer>> yearsBySeries) {
        Map<String, SortedMap<Integer, BigDecimal>> bySeries = new TreeMap<>();
        yearsBySeries.forEach(
                (series, years) -> {
                    SortedMap<Integer, BigDecimal> annual = new TreeMap<>();
                    years.forEach(year -> annual.put(year, BigDecimal.ONE));
                    bySeries.put(series, annual);
                });
        return new YearValues(bySeries);
    }

    @Test
    void yearsNoteDoesNotReadGapsAsAContinuousPeriod() {
        assertThat(CardApplicability.yearsNote(new TreeSet<>())).isEqualTo("0개");
        assertThat(CardApplicability.yearsNote(new TreeSet<>(List.of(2025)))).isEqualTo("1개(2025)");
        assertThat(CardApplicability.yearsNote(new TreeSet<>(List.of(2023, 2024, 2025))))
                .isEqualTo("3개(2023–2025)");
        assertThat(CardApplicability.yearsNote(new TreeSet<>(List.of(2023, 2025))))
                .isEqualTo("2개(2023 · 2025)");
    }

    @Test
    void rowsFollowCardContractOrderAndUnknownConditionsGoLast() {
        // jsonb 는 칸 순서를 남기지 않는다 — 입력 순서와 상관없이 카드 계약 순서
        List<Applicability> rows =
                CardApplicability.check(
                        conditions(
                                "{\"population\": \"청년 19–39세\", \"new_rule\": 1,"
                                        + " \"min_complete_years\": 3, \"place_level\": \"sigungu\"}"),
                        "여수시",
                        "sigungu",
                        values(Map.of("_place", List.of(2023, 2024, 2025))),
                        null);
        assertThat(rows)
                .extracting(Applicability::condition)
                .containsExactly("place_level", "min_complete_years", "population", "new_rule");
        assertThat(rows.get(3).passed()).isNull();
    }

    @Test
    void stoppedRunChecksOnlyPlaceLevel() {
        List<Applicability> rows =
                CardApplicability.check(
                        conditions(
                                "{\"place_level\": \"sigungu\", \"min_complete_years\": 3,"
                                        + " \"min_stations\": 1}"),
                        "중앙동",
                        "emd",
                        null,
                        "필수 근거(통계)가 없어 확인하지 않음");
        assertThat(rows)
                .containsExactly(
                        new Applicability("place_level", "시군구 단위", false, "중앙동(읍면동)"),
                        new Applicability(
                                "min_complete_years",
                                "완전한 연 값 3개 이상",
                                null,
                                "필수 근거(통계)가 없어 확인하지 않음"),
                        new Applicability(
                                "min_stations", "측정소 1곳 이상", null, "필수 근거(통계)가 없어 확인하지 않음"));
    }

    @Test
    void stationYearsAreTheUnionAcrossStations() {
        List<Applicability> rows =
                CardApplicability.check(
                        conditions(
                                "{\"place_level\": \"sigungu\", \"min_complete_years\": 3,"
                                        + " \"min_stations\": 1}"),
                        "여수시",
                        "sigungu",
                        values(Map.of("336121", List.of(2023, 2025), "336124", List.of(2025))),
                        null);
        assertThat(rows.get(1))
                .isEqualTo(
                        new Applicability(
                                "min_complete_years", "완전한 연 값 3개 이상", false, "2개(2023 · 2025)"));
        assertThat(rows.get(2))
                .isEqualTo(new Applicability("min_stations", "측정소 1곳 이상", true, "측정소 2곳"));
    }
}
