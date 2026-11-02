package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.dto.ArgumentResponse.Article;
import com.c108.issueatlas.question.dto.ArgumentResponse.CountSeries;
import com.c108.issueatlas.question.dto.ArgumentResponse.MoveSeries;
import com.c108.issueatlas.question.dto.ArgumentResponse.Series;
import com.c108.issueatlas.question.dto.ArgumentResponse.StatSeries;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.ArticleRow;
import com.c108.issueatlas.question.repository.QuestionRepository.SeriesRow;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 질문 응답의 series[] · 근거 기사 목록(「시공간 표시 개발 명세」 5 · 6절). observation view(V0025)를 묶어 월 순서로 늘어놓는다. 판정하지
 * 않고, 화면용으로 연으로 묶지 않는다.
 */
@Service
public class SeriesService {
    // 카드에 연결한 지표(명세 7절 그림): C1 = 청년 순이동 막대 + 이동, A3 = 측정소 PM2.5 지도.
    // ponytail: 카드 두 개라 상수. 카드가 늘면 카드 ↔ 지표 표로 옮긴다
    private static final Map<String, List<String>> CARD_INDICATORS =
            Map.of(
                    "C1", List.of("population_net_migration_19_39", "population_movers"),
                    "A3", List.of("air_pm25"));
    private static final String NO_ROW = "not_collected";

    private final QuestionRepository questions;

    public SeriesService(QuestionRepository questions) {
        this.questions = questions;
    }

    public List<Series> series(
            String cardId, String placeId, String placeName, LocalDate start, LocalDate end) {
        return series(cardId, null, placeId, placeName, start, end);
    }

    public List<Series> series(
            String cardId,
            List<String> approvedIndicators,
            String placeId,
            String placeName,
            LocalDate start,
            LocalDate end) {
        List<String> indicators =
                approvedIndicators == null
                        ? CARD_INDICATORS.getOrDefault(cardId, List.of())
                        : approvedIndicators;
        List<String> periods = months(start, end);
        List<Series> out = new ArrayList<>();
        if (!indicators.isEmpty()) {
            Map<List<String>, List<SeriesRow>> lines =
                    questions.seriesRows(indicators, placeId, start, end).stream()
                            .collect(
                                    Collectors.groupingBy(
                                            r ->
                                                    Arrays.asList(
                                                            r.whatId(),
                                                            r.stationId(),
                                                            r.toPlaceId()),
                                            LinkedHashMap::new,
                                            Collectors.toList()));
            List<Double> from = questions.point(placeId);
            // 그림 순서 = 카드 지표 순서(명세 7절). 같은 지표 안은 SQL 순서(측정소 · 도착지)
            lines.values().stream()
                    .sorted(
                            Comparator.comparingInt(
                                    rows -> indicators.indexOf(rows.get(0).whatId())))
                    .forEach(rows -> out.add(line(rows, placeId, placeName, from, periods)));
        }
        out.addAll(counts(cardId, placeId, start, end, periods));
        return out;
    }

    public List<Article> articles(String cardId, String placeId, LocalDate start, LocalDate end) {
        return questions.articles(cardId, placeId, start, end).stream()
                .map(
                        a ->
                                new Article(
                                        a.id(),
                                        LocalDate.parse(a.date()),
                                        a.placeId(),
                                        a.lon() == null ? null : List.of(a.lon(), a.lat()),
                                        a.locationPrecision(),
                                        a.summary(),
                                        a.placeName(),
                                        a.url()))
                .toList();
    }

    private static Series line(
            List<SeriesRow> rows,
            String placeId,
            String placeName,
            List<Double> from,
            List<String> periods) {
        SeriesRow first = rows.get(0);
        Map<String, SeriesRow> byPeriod = new HashMap<>();
        rows.forEach(r -> byPeriod.put(r.period(), r));
        List<Number> values = new ArrayList<>();
        List<String> statuses = new ArrayList<>();
        for (String p : periods) {
            SeriesRow r = byPeriod.get(p);
            String status = r == null ? NO_ROW : r.status();
            statuses.add(status);
            values.add("available".equals(status) ? r.value() : null);
        }
        if (first.toPlaceId() != null) {
            return new MoveSeries(
                    first.whatId(),
                    placeId,
                    first.toPlaceId(),
                    first.toName(),
                    from,
                    Arrays.asList(first.toLon(), first.toLat()),
                    first.unit(),
                    periods,
                    values,
                    statuses);
        }
        boolean station = first.stationId() != null;
        return new StatSeries(
                first.whatId(),
                placeId,
                first.stationId(),
                station ? first.stationName() : placeName,
                station ? Arrays.asList(first.lon(), first.lat()) : null,
                first.unit(),
                periods,
                values,
                statuses);
    }

    /** 기사 건수 series: 카드 태그가 붙은 근거 기사를 기사 지역마다 월별로 센다(확산 그림). */
    private List<Series> counts(
            String cardId, String placeId, LocalDate start, LocalDate end, List<String> periods) {
        Map<String, List<ArticleRow>> byPlace =
                questions.articles(cardId, placeId, start, end).stream()
                        .collect(
                                Collectors.groupingBy(
                                        ArticleRow::placeId,
                                        LinkedHashMap::new,
                                        Collectors.toList()));
        List<Series> out = new ArrayList<>();
        byPlace.forEach(
                (place, rows) -> {
                    Map<String, Long> perMonth =
                            rows.stream()
                                    .collect(
                                            Collectors.groupingBy(
                                                    r -> r.date().substring(0, 7),
                                                    Collectors.counting()));
                    ArticleRow first = rows.get(0);
                    out.add(
                            new CountSeries(
                                    cardId,
                                    place,
                                    Objects.requireNonNullElse(first.areaName(), first.placeName()),
                                    first.areaLon() == null
                                            ? null
                                            : List.of(first.areaLon(), first.areaLat()),
                                    "건",
                                    periods,
                                    periods.stream()
                                            .map(p -> (Number) perMonth.getOrDefault(p, 0L))
                                            .toList(),
                                    periods.stream().map(p -> "available").toList()));
                });
        return out;
    }

    /** [start, end) 의 달 「YYYY-MM」. */
    static List<String> months(LocalDate start, LocalDate end) {
        List<String> out = new ArrayList<>();
        for (YearMonth m = YearMonth.from(start);
                m.isBefore(YearMonth.from(end.minusDays(1)).plusMonths(1));
                m = m.plusMonths(1)) {
            out.add(m.toString());
        }
        return out;
    }
}
