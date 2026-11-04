package com.c108.issueatlas.review.dto;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class ReviewDto {
    private ReviewDto() {}

    public record Submit(
            @NotBlank @Pattern(regexp = "news_event|normalized_record|source|card")
                    String targetType,
            @NotBlank @Size(max = 200) String targetId,
            @NotBlank
                    @Pattern(
                            regexp =
                                    "location|classification|duplicate|value|wording|metadata|other")
                    String issueType,
            @Size(max = 20) String cardId,
            @NotBlank @Size(max = 2000) String reason,
            JsonNode proposedValue) {}

    public record Decide(
            @NotNull @Min(0) Long expectedRevision,
            @NotBlank @Pattern(regexp = "confirm|correct|hold|reject") String action,
            @NotBlank @Pattern(regexp = "record|source|card") String scope,
            @NotBlank @Size(max = 2000) String reason,
            JsonNode expectedValue,
            JsonNode after,
            @Min(1) Long approverId) {}

    public record Request(
            String reviewId,
            String origin,
            String targetType,
            String targetId,
            String issueType,
            String cardId,
            String reason,
            JsonNode proposedValue,
            JsonNode submittedValue,
            long submittedBy,
            String status,
            long revision,
            String approvalRequestId,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {}

    public record Detail(
            Request request,
            JsonNode currentValue,
            List<String> proposableFields,
            List<String> editableFields,
            String scope,
            String approvalStatus,
            List<String> supportedActions,
            List<Change> decisions) {}

    public record Change(
            String changeId,
            String reviewId,
            String targetType,
            String targetId,
            String action,
            String scope,
            Long actorId,
            String actorEmail,
            String reason,
            JsonNode beforeValue,
            JsonNode afterValue,
            long revision,
            OffsetDateTime createdAt) {}

    public record Page<T>(List<T> items, int page, int size, long total) {}
}
