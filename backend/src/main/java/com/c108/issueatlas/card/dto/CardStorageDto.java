package com.c108.issueatlas.card.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class CardStorageDto {
    private CardStorageDto() {}

    public record CreateCard(
            @NotBlank @Pattern(regexp = "[A-H][0-9]{1,3}") String cardId,
            @NotBlank @Size(max = 200) String name,
            @NotBlank @Size(max = 100) String domain,
            @NotBlank @Size(max = 500) String parentQuestion) {}

    public record SaveDraft(@NotNull @Min(0) Long expectedRevision, @NotNull JsonNode spec) {}

    public record Approve(
            @NotNull @Min(0) Long expectedRevision, @NotBlank @Size(max = 2000) String reason) {}

    public record CardDraft(
            String cardId,
            String status,
            int cardVersion,
            Integer currentVersion,
            long draftRevision,
            JsonNode draftSpec) {}

    public record Check(int checkNo, boolean ok, String label) {}

    public record Validation(long draftRevision, boolean valid, List<Check> checks) {}

    public record Version(
            String cardId,
            int version,
            JsonNode spec,
            long draftRevision,
            String approvedBy,
            OffsetDateTime approvedAt) {}

    public record Revision(
            long revisionId,
            int fromVersion,
            int toVersion,
            String reason,
            String approvedBy,
            OffsetDateTime createdAt) {}

    public record SaveIndicator(
            @NotNull @Min(0) Integer expectedRuleVersion,
            @NotNull JsonNode definition,
            JsonNode rule,
            String numeratorId,
            String denominatorId,
            String baseId,
            String addedByCard,
            boolean verified) {}

    public record Indicator(
            String indicatorId,
            JsonNode definition,
            JsonNode rule,
            int ruleVersion,
            String numeratorId,
            String denominatorId,
            String baseId,
            String addedByCard,
            String status) {}
}
