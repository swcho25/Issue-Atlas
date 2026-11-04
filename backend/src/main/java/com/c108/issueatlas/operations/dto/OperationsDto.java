package com.c108.issueatlas.operations.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public final class OperationsDto {
    private OperationsDto() {}

    @Schema(name = "OperationsPeriod")
    public record Period(OffsetDateTime from, OffsetDateTime to) {}

    @Schema(name = "OperationsQueues")
    public record Queues(
            Map<String, Long> reviews, Map<String, Long> approvals, Map<String, Long> imports) {}

    @Schema(name = "OperationsActivity")
    public record Activity(
            Map<String, Long> reviewDecisions,
            Map<String, Long> approvalDecisions,
            Map<String, Long> importResults,
            Map<String, Long> jobsStarted) {}

    @Schema(name = "OperationsInventory")
    public record Inventory(long rawRecords, long normalizedRecords, long readyRecords) {}

    @Schema(name = "OperationsSourceStatus")
    public record SourceStatus(
            String sourceId,
            String name,
            String storageScope,
            String reliabilityGrade,
            String robotsStatus,
            long specCount,
            long neverRunSpecCount,
            String latestJobStatus,
            OffsetDateTime lastStartedAt,
            OffsetDateTime lastSuccessfulAt) {}

    @Schema(name = "OperationsOverview")
    public record Overview(
            OffsetDateTime generatedAt,
            Period period,
            Queues currentQueues,
            Activity periodActivity,
            Inventory currentInventory,
            List<SourceStatus> sourceStatuses) {}

    @Schema(name = "OperationsRun")
    public record Run(
            String runId,
            String questionId,
            String placeId,
            String placeName,
            String cardId,
            String cardName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String runStatus,
            Integer cardVersion,
            String formulaVersion,
            String taxonomyVersion,
            String previousRunId,
            Integer filledCells,
            Integer editCount,
            OffsetDateTime createdAt) {}

    public record RunFilter(
            String placeId, String cardId, LocalDate periodStart, LocalDate periodEnd) {}

    @Schema(name = "OperationsRunPage")
    public record Page(List<Run> items, long total, int page, int size) {}

    @Schema(name = "OperationsRate")
    public record Rate(
            Integer numerator,
            Integer denominator,
            BigDecimal percentage,
            String unavailableReason) {}

    @Schema(name = "OperationsCount")
    public record Count(Integer value, String unavailableReason) {}

    @Schema(name = "OperationsCoverage")
    public record Coverage(List<String> requiredKinds, Rate rate) {}

    @Schema(name = "OperationsMetrics")
    public record Metrics(Rate filledCells, Coverage requiredEvidence, Count editedCells) {}

    @Schema(name = "OperationsSnapshot")
    public record Snapshot(
            Run run,
            Metrics metrics,
            @Schema(type = "object", description = "저장된 C2 논증 결과 원본") JsonNode result) {}

    @Schema(name = "OperationsDelta")
    public record Delta(BigDecimal value, String unit, String unavailableReason) {}

    @Schema(name = "OperationsDeltas")
    public record Deltas(Delta filledCells, Delta requiredEvidence, Delta editedCells) {}

    @Schema(name = "OperationsLinkedChanges")
    public record LinkedChanges(List<String> changeIds, String unavailableReason) {}

    @Schema(name = "OperationsComparison")
    public record Comparison(
            boolean comparable,
            List<String> reasons,
            List<String> warnings,
            Snapshot before,
            Snapshot after,
            Deltas deltas,
            LinkedChanges linkedReviewChanges) {}
}
