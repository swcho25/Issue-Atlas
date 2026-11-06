package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.dto.ApprovedCard;
import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import com.c108.issueatlas.question.dto.ArgumentResponse.Condition;
import com.c108.issueatlas.question.dto.ArgumentResponse.Question;
import com.c108.issueatlas.question.service.CardJudge.Judgment;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/** 판단 ① 문장: 결과 문장(claim_text)에 첫해 · 끝해 연 값, 없으면 claim_template(S15P31C108-282). */
class ClaimTextTest {
    private static final Question YEOSU =
            new Question(
                    "q",
                    "kr-12130",
                    "여수시",
                    "C1",
                    "청년 유출·정착",
                    LocalDate.of(2023, 1, 1),
                    LocalDate.of(2026, 1, 1));
    private static final Condition OK = new Condition(true, "");
    private final ApprovedCard card =
            new ApprovedCard(
                    "C1",
                    3,
                    new ObjectMapper()
                            .readTree(
                                    "{\"claim_template\": \"{지역}에서 {기간} 청년(19–39세) 순이동이 {판정값}\"}"));

    private static SortedMap<Integer, BigDecimal> years(String... values) {
        SortedMap<Integer, BigDecimal> years = new TreeMap<>();
        for (int i = 0; i < values.length; i++) years.put(2023 + i, new BigDecimal(values[i]));
        return years;
    }

    private static Judgment judgment(
            String claimText,
            Map<String, Object> facts,
            Map<String, SortedMap<Integer, BigDecimal>> series) {
        return new Judgment(
                "increasing",
                "calculated",
                "청년(19–39세) 순이동",
                "청년 순유출 확대",
                claimText,
                new Comparability(OK, OK, OK, OK),
                List.of("ev_stat"),
                List.of(),
                List.of(),
                facts,
                "population_net_migration_19_39",
                "명",
                new YearValues(series));
    }

    @Test
    void outcomeSentenceGetsFirstAndLastYearValuesAsAbsoluteNumbers() {
        Judgment c1 =
                judgment(
                        "{지역} 청년(19–39세) 순유출은 {첫해}년 {첫값}명에서 {끝해}년 {끝값}명으로 매년 커졌습니다.",
                        Map.of("yearCount", 3),
                        Map.of("place", years("-1537", "-1935", "-2262")));
        assertThat(QuestionService.claimText(c1, YEOSU, card))
                .isEqualTo("여수시 청년(19–39세) 순유출은 2023년 1,537명에서 2025년 2,262명으로 매년 커졌습니다.");
    }

    @Test
    void ruleMeansAreUsedForStationCards() {
        // A3: 측정소가 여럿이면 규칙이 계산한 공통 측정소 평균(firstMean · lastMean)이 시군구 연 값이다
        Judgment a3 =
                judgment(
                        "{지역} 측정소 {n}곳의 연평균은 {첫해}년 {첫값}µg/m³에서 {끝해}년 {끝값}µg/m³로 낮아졌습니다.",
                        Map.of(
                                "commonStationCount", 2,
                                "firstYear", 2023,
                                "lastYear", 2025,
                                "firstMean", new BigDecimal("18.65"),
                                "lastMean", new BigDecimal("15")),
                        Map.of("s1", years("18.6", "17", "15"), "s2", years("18.7", "16", "15")));
        assertThat(QuestionService.claimText(a3, YEOSU, card))
                .isEqualTo("여수시 측정소 2곳의 연평균은 2023년 18.7µg/m³에서 2025년 15µg/m³로 낮아졌습니다.");
    }

    @Test
    void withoutOutcomeSentenceOrYearValuesTheCardTemplateIsUsed() {
        String expected = "여수시에서 2023–2025 청년(19–39세) 순이동이 청년 순유출 확대.";
        // v3 전 승인본: 결과 문장이 없다
        assertThat(
                        QuestionService.claimText(
                                judgment(null, Map.of(), Map.of("place", years("-1", "-2", "-3"))),
                                YEOSU,
                                card))
                .isEqualTo(expected);
        // 연 값 빈칸이 있는데 시군구 연 값을 정할 수 없다(계열 여럿 · 평균 없음)
        assertThat(
                        QuestionService.claimText(
                                judgment(
                                        "{지역} {첫해}년 {첫값}명",
                                        Map.of(),
                                        Map.of("a", years("1"), "b", years("2"))),
                                YEOSU,
                                card))
                .isEqualTo(expected);
    }

    @Test
    void numbersAreAbsoluteWithCommasAndOneDecimalWhenNotWhole() {
        assertThat(QuestionService.number(new BigDecimal("-2262"))).isEqualTo("2,262");
        assertThat(QuestionService.number(new BigDecimal("15.000"))).isEqualTo("15");
        assertThat(QuestionService.number(new BigDecimal("13.25"))).isEqualTo("13.3");
        assertThat(QuestionService.number(new BigDecimal("16.9333333"))).isEqualTo("16.9");
    }
}
