package com.c108.issueatlas.question.controller;

import com.c108.issueatlas.question.dto.ArgumentResponse;
import com.c108.issueatlas.question.dto.MyQuestionList;
import com.c108.issueatlas.question.dto.QuestionCreateRequest;
import com.c108.issueatlas.question.dto.QuestionCreateResponse;
import com.c108.issueatlas.question.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "questions")
@RestController
public class QuestionController {
    private final QuestionService questions;

    public QuestionController(QuestionService questions) {
        this.questions = questions;
    }

    /** 로그인 없이도 묻는다. 로그인했으면 묻는 사람을 남겨 내 질문에 뜬다(익명이면 asker 가 null). */
    @Operation(
            operationId = "createQuestion",
            summary = "질문(지역 × 카드 × 기간) 저장 후 실행. card_id 가 null 이면 신규 카드 후보")
    @PostMapping("/v1/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionCreateResponse create(
            @Valid @RequestBody QuestionCreateRequest request, Principal asker) {
        return questions.create(request, asker == null ? null : asker.getName());
    }

    @Operation(
            operationId = "rerunQuestion",
            summary = "내 질문을 같은 지역 · 카드 · 기간으로 다시 실행(같은 질문의 새 실행)")
    @PostMapping("/v1/questions/{question_id}/runs")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionCreateResponse rerun(
            @PathVariable("question_id") String questionId, Principal asker) {
        return questions.rerun(questionId, asker.getName());
    }

    @Operation(operationId = "listMyQuestions", summary = "내 질문(로그인한 사람이 물은 질문)과 실행 회차")
    @GetMapping("/v1/me/questions")
    public MyQuestionList mine(Principal asker) {
        return questions.mine(asker.getName());
    }

    /** 실행 때 저장한 C2 argument 를 그대로 준다. */
    @Operation(operationId = "getArgument", summary = "근거 수요표 + 논증 카드 6칸")
    @ApiResponse(
            responseCode = "200",
            description = "논증 결과 (contracts/c2/schemas/argument.schema.json)",
            content =
                    @Content(
                            mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = ArgumentResponse.class)))
    @GetMapping("/v1/arguments/{run_id}")
    public ResponseEntity<String> argument(@PathVariable("run_id") String runId) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(questions.argument(runId));
    }
}
