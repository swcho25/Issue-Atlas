package com.c108.issueatlas.card.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class CardApprovalDto {
    private CardApprovalDto() {}

    public record Submit(
            @NotNull @Min(0) Long expectedRevision,
            @NotNull @Min(1) Long approverId,
            @NotBlank @Size(max = 2000) String reason) {}

    public record Decide(
            @NotNull @Min(0) Long expectedRevision,
            @NotBlank @Pattern(regexp = "approve|reject|hold") String decision,
            @NotBlank @Size(max = 2000) String reason) {}

    public record Request(
            String requestId,
            String cardId,
            long draftRevision,
            long requestedBy,
            String requesterName,
            long approverId,
            String approverName,
            String status,
            String reason,
            long revision,
            OffsetDateTime createdAt,
            Long decidedBy,
            OffsetDateTime decidedAt,
            String decisionReason,
            Integer approvedVersion) {}

    public record Decision(
            long decisionId,
            long actorId,
            String decision,
            String reason,
            OffsetDateTime createdAt) {}

    public record Detail(
            Request request,
            JsonNode draftSpec,
            JsonNode indicatorVersions,
            Integer currentVersion,
            List<Decision> decisions) {}

    public record Page(List<Request> items, int page, int size, long total) {}
}
