package com.c108.issueatlas.question.dto;

import tools.jackson.databind.JsonNode;

/** 실행 당시 카드 버전의 불변 승인본. */
public record ApprovedCard(String cardId, int version, JsonNode spec) {}
