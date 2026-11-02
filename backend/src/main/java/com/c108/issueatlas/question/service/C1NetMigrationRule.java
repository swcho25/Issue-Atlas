package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import com.c108.issueatlas.question.dto.ArgumentResponse.Condition;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.SeriesRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * C1 청년 유출 · 정착 판정(contracts/cards/C1.json rule, 대표 결정 2026-11-01 · 세부 해석 2026-11-02). 청년(19–39세)
 * 순이동 월 값을 해마다 합하고(12개월이 모두 있는 해만), 완전한 해가 3개 이상이면 위에서부터 처음 맞는 결과를 낸다. 변화 폭 임계는 없다.
 */
@Component
public class C1NetMigrationRule implements CardRule {
    static final String INDICATOR = "population_net_migration_19_39";
    static final int MIN_YEARS = 3;

    private final QuestionRepository questions;

    public C1NetMigrationRule(QuestionRepository questions) {
        this.questions = questions;
    }

    public String cardId() {
        return "C1";
    }

    public String formulaVersion() {
        return "c1-net-migration-0.1";
    }

    public String indicatorId() {
        return INDICATOR;
    }

    public String warrant() {
        return "청년 순유출이 여러 해 지속되면 그 지역의 청년 정착 기반이 약해지고 있다고 본다. 순이동은 정착 여부를 직접 재는 유일한 공식 지표다";
    }

    public List<String> ceiling() {
        return List.of("떠난 이유", "행선지 해석", "정책 효과", "향후 추세", "타 지역과 우열");
    }

    public Judgment judge(String placeId, LocalDate start, LocalDate end, int cardVersion) {
        List<BigDecimal> years =
                yearSums(questions.seriesRows(List.of(INDICATOR), placeId, start, end), start, end);
        List<String> statistics =
                questions
                        .statisticsEvidence(
                                "SP01", INDICATOR, "청년(19–39세) 순이동", placeId, start, end)
                        .map(List::of)
                        .orElse(List.of());
        Condition ok = new Condition(true, null);
        String[] outcome = outcome(years);
        Condition period =
                new Condition(
                        years.size() >= MIN_YEARS,
                        "12개월이 모두 있는 해 " + years.size() + "개(" + MIN_YEARS + "개 이상 필요)");
        return new Judgment(
                outcome[0],
                outcome[0].equals("insufficient") ? "insufficient_evidence" : "calculated",
                "청년(19–39세) 순이동",
                outcome[1],
                new Comparability(
                        new Condition(true, "같은 지표 " + INDICATOR),
                        period,
                        ok,
                        new Condition(true, "전입 − 전출, 19–39세 밴드 고정")),
                statistics,
                List.of(),
                List.of());
    }

    /** {claim, label}. C1.json rule.outcomes 순서. */
    static String[] outcome(List<BigDecimal> years) {
        if (years.size() < MIN_YEARS) {
            return new String[] {"insufficient", "근거 부족"};
        }
        boolean negative = years.stream().allMatch(v -> v.signum() < 0);
        boolean widening = true;
        boolean narrowing = true;
        for (int i = 1; i < years.size(); i++) {
            int c = years.get(i).abs().compareTo(years.get(i - 1).abs());
            widening &= c > 0;
            narrowing &= c < 0;
        }
        if (negative && widening) {
            return new String[] {"increasing", "청년 순유출 확대"};
        }
        if (negative && narrowing) {
            return new String[] {"decreasing", "청년 순유출 축소"};
        }
        // 앞선 해에 음수가 있어야 전환이다. 모두 양수는 전환이 아니라 불분명(-159 세부 해석)
        boolean earlierOutflow =
                years.subList(0, years.size() - 1).stream().anyMatch(v -> v.signum() < 0);
        if (earlierOutflow && years.get(years.size() - 1).signum() > 0) {
            return new String[] {"decreasing", "순유입 전환"};
        }
        return new String[] {"unclear", "불분명"};
    }

    /** 질문 기간 안에 통째로 든 해마다 월 값 합. 12개월이 모두 available 인 해만, 해 순서대로. */
    static List<BigDecimal> yearSums(List<SeriesRow> rows, LocalDate start, LocalDate end) {
        Map<String, List<SeriesRow>> byYear =
                rows.stream()
                        .filter(r -> "available".equals(r.status()) && r.value() != null)
                        .collect(Collectors.groupingBy(r -> r.period().substring(0, 4)));
        List<BigDecimal> out = new ArrayList<>();
        int first = start.getDayOfYear() == 1 ? start.getYear() : start.getYear() + 1;
        for (int y = first; !LocalDate.of(y + 1, 1, 1).isAfter(end); y++) {
            List<SeriesRow> months = byYear.getOrDefault(String.valueOf(y), List.of());
            if (months.stream().map(SeriesRow::period).distinct().count() == 12) {
                out.add(
                        months.stream()
                                .map(SeriesRow::value)
                                .reduce(BigDecimal.ZERO, BigDecimal::add));
            }
        }
        return out;
    }
}
