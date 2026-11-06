package com.c108.issueatlas.question.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** C2 my-question-list. 로그인한 사람이 물은 질문과 그 실행(회차, 새것부터). */
public record MyQuestionList(String schemaVersion, List<MyQuestion> questions) {

    /** candidate = card_id 가 없어 신규 카드 후보로 저장한 질문 */
    public record MyQuestion(
            String questionId,
            String placeId,
            String placeName,
            String cardId,
            String cardName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String rawText,
            boolean candidate,
            OffsetDateTime createdAt,
            List<MyRun> runs) {}

    /** claim · claim_text 는 그 실행에 저장된 결과의 판단 그대로 */
    public record MyRun(
            String runId,
            String runStatus,
            OffsetDateTime createdAt,
            String claim,
            String claimText) {}
}
