package com.c108.issueatlas.question.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** C2 argument — 근거 수요표 + 논증 카드 6칸. 칸 이름은 snake_case 설정(application.yml)으로 나간다. */
public record ArgumentResponse(
        String schemaVersion,
        String runId,
        Question question,
        Integer cardVersion,
        String formulaVersion,
        String taxonomyVersion,
        String runStatus,
        OffsetDateTime createdAt,
        List<EvidenceRow> evidenceTable,
        List<Applicability> applicability,
        Comparability comparability,
        Claim claim,
        Data data,
        Text warrant,
        Qualifier qualifier,
        List<Rebuttal> rebuttals,
        Ceiling ceiling,
        List<Series> series,
        List<Article> articles) {
    /** ⑤ 반박만 바꾼 같은 응답(문장화 결과를 끼울 때). ③ 보증은 늘 카드 문장이고 다른 칸도 그대로다. */
    public ArgumentResponse withRebuttals(List<Rebuttal> rebuttals) {
        return new ArgumentResponse(
                schemaVersion,
                runId,
                question,
                cardVersion,
                formulaVersion,
                taxonomyVersion,
                runStatus,
                createdAt,
                evidenceTable,
                applicability,
                comparability,
                claim,
                data,
                warrant,
                qualifier,
                rebuttals,
                ceiling,
                series,
                articles);
    }

    /**
     * 화면 그림 한 줄(「시공간 표시 개발 명세」 5절). 세 배열(periods · values · statuses)은 길이가 같고 월 순서다. 그림 종류는 모양이
     * 정한다: to 가 있으면 이동, tag 가 있으면 기사 건수(확산), coordinates 가 있으면 지도, 없으면 막대.
     */
    public sealed interface Series permits StatSeries, MoveSeries, CountSeries {}

    public record StatSeries(
            String indicatorId,
            String placeId,
            String stationId,
            String name,
            List<Double> coordinates,
            String unit,
            List<String> periods,
            List<Number> values,
            List<String> statuses)
            implements Series {}

    public record MoveSeries(
            String indicatorId,
            String from,
            String to,
            String toName,
            List<Double> fromCoordinates,
            List<Double> toCoordinates,
            String unit,
            List<String> periods,
            List<Number> values,
            List<String> statuses)
            implements Series {}

    public record CountSeries(
            String tag,
            String placeId,
            String name,
            List<Double> coordinates,
            String unit,
            List<String> periods,
            List<Number> values,
            List<String> statuses)
            implements Series {}

    /** 근거 기사 한 건. 기사는 series 가 아니라 이 목록으로 보낸다. 좌표를 못 정한 기사는 point null. */
    public record Article(
            String id,
            LocalDate date,
            String placeId,
            List<Double> point,
            String precision,
            String summary,
            String placeName,
            String url) {}

    public record Question(
            String questionId,
            String placeId,
            String placeName,
            String cardId,
            String cardName,
            LocalDate periodStart,
            LocalDate periodEnd) {}

    public record EvidenceRow(
            String kind,
            boolean required,
            String status,
            int count,
            int reviewPendingCount,
            String reason) {}

    public record Condition(Boolean passed, String note) {}

    /**
     * 카드 적용 조건(양식 B6) 한 줄(C2 v1). passed: true 충족 · false 못 채움 · null 확인하지 못함(판정 전에 멈춤) 또는 표시만 하는
     * 조건(대상).
     */
    public record Applicability(String condition, String label, Boolean passed, String note) {}

    public record Comparability(
            Condition sameIndicator,
            Condition samePeriodLength,
            Condition sameBoundary,
            Condition sameMethod) {}

    /**
     * label: 판정 배지 글자 = 승인본 rule.outcomes[].label. 판정하지 않은 실행(blocked · unsupported)은 null(C2 v1).
     */
    public record Claim(String value, String label, String level, String text, String provenance) {}

    public record Ref(
            String evidenceId,
            String title,
            String sourceName,
            String sourceGrade,
            LocalDate periodStart,
            LocalDate periodEnd,
            String storageScope) {}

    public record Data(
            List<Ref> statistics,
            List<Ref> documents,
            List<Ref> existingResponses,
            List<Ref> denominators,
            String provenance) {}

    public record Text(String text, String provenance) {}

    public record Components(
            int aGradeSources,
            int abGradeSources,
            int independentEvidence,
            OffsetDateTime latestObservedAt,
            boolean latestWithinOneYear) {}

    public record Qualifier(
            String grade, Components components, String formulaVersion, String provenance) {}

    public record Rebuttal(String text, String status, String provenance) {}

    public record Ceiling(List<String> items, String provenance) {}
}
