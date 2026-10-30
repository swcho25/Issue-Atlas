package com.c108.issueatlas.card.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.List;

/** C2 place-cards. 확보 종류 수는 품질 점수나 심각도 순위가 아니다. */
public record PlaceCardsResponse(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("place_id") String placeId,
        @JsonProperty("period_start") LocalDate periodStart,
        @JsonProperty("period_end") LocalDate periodEnd,
        @JsonProperty("taxonomy_version") String taxonomyVersion,
        List<CardResponse> cards) {
    public record CardResponse(
            @JsonProperty("card_id") String cardId,
            String name,
            String domain,
            @JsonProperty("parent_question") String parentQuestion,
            @JsonProperty("card_version") int cardVersion,
            List<EvidenceResponse> evidence,
            @JsonProperty("available_kinds") int availableKinds,
            @JsonProperty("review_pending_count") int reviewPendingCount) {}

    public record EvidenceResponse(String kind, String status) {}
}
