package com.c108.issueatlas.question.controller;

import com.c108.issueatlas.question.dto.QuestionCandidatePage;
import com.c108.issueatlas.question.service.QuestionCandidateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 새 이슈 후보 목록. ADMIN 판정은 SecurityConfig 의 /v1/admin/** 규칙 한 곳에서 한다. */
@RestController
@RequestMapping("/v1/admin")
@Tag(name = "admin")
public class AdminQuestionCandidateController {
    private final QuestionCandidateService service;

    public AdminQuestionCandidateController(QuestionCandidateService service) {
        this.service = service;
    }

    @GetMapping("/question-candidates")
    @Operation(
            summary = "새 이슈 후보 목록",
            description =
                    "새 질문에서 카드 없이 저장한 질문(신규 카드 후보)을 접수 최신 순으로. 원문의 「이슈 이름:」 · 「궁금한 까닭:」"
                            + " 줄을 issue_name · reason 으로 나눈다. 읽기만 한다.")
    public QuestionCandidatePage list(
            @RequestParam(name = "place_id", required = false) String placeId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(placeId, page, size);
    }
}
