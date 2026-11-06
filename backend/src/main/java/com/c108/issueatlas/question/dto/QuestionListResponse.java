package com.c108.issueatlas.question.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** GET /v1/questions 내 질문 목록(C2 question-list). 질문마다 마지막 실행. */
public record QuestionListResponse(String schemaVersion, List<Item> questions) {
    public record Item(
            String questionId,
            String placeId,
            String placeName,
            String cardId,
            String cardName,
            LocalDate periodStart,
            LocalDate periodEnd,
            OffsetDateTime createdAt,
            String runId,
            String runStatus,
            String claim) {}
}
