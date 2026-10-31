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
        Comparability comparability,
        Claim claim,
        Data data,
        Text warrant,
        Qualifier qualifier,
        List<Rebuttal> rebuttals,
        Ceiling ceiling) {
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

    public record Comparability(
            Condition sameIndicator,
            Condition samePeriodLength,
            Condition sameBoundary,
            Condition sameMethod) {}

    public record Claim(String value, String level, String text, String provenance) {}

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
