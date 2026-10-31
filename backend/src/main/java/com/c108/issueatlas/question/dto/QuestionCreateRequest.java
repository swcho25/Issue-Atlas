package com.c108.issueatlas.question.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** C2 question-create-request. card_id null = 목록에 없는 질문(신규 카드 후보). */
public record QuestionCreateRequest(
        @NotBlank String placeId,
        String cardId,
        @NotNull LocalDate periodStart,
        @NotNull LocalDate periodEnd,
        String rawText) {}
