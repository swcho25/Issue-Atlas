package com.c108.issueatlas.question.dto;

/** C2 question-create-response. */
public record QuestionCreateResponse(
        String schemaVersion,
        String questionId,
        String runId,
        String runStatus,
        boolean candidate) {}
