package com.c108.issueatlas.question.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 관리자 새 이슈 후보 목록(contracts/question-candidates). 새 질문에서 카드 없이 저장한 질문을 접수 최신 순으로. issueName · reason
 * · sentence 는 raw_text 의 「이슈 이름:」 · 「궁금한 까닭:」 줄과 나머지 줄이다.
 */
public record QuestionCandidatePage(List<QuestionCandidate> items, long total, int page, int size) {

    public record QuestionCandidate(
            String questionId,
            String placeId,
            String placeName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String issueName,
            String reason,
            String sentence,
            String rawText,
            @Schema(nullable = true) QuestionCandidateAsker askedBy,
            OffsetDateTime createdAt) {}

    /** 묻는 사람. 로그인 없이 물었으면 askedBy 가 null */
    public record QuestionCandidateAsker(long id, String name, String email) {}
}
