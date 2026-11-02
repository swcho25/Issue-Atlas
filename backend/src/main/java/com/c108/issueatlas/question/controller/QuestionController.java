package com.c108.issueatlas.question.controller;

import com.c108.issueatlas.question.dto.QuestionCreateRequest;
import com.c108.issueatlas.question.dto.QuestionCreateResponse;
import com.c108.issueatlas.question.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class QuestionController {
    private final QuestionService questions;

    public QuestionController(QuestionService questions) {
        this.questions = questions;
    }

    @PostMapping("/v1/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionCreateResponse create(@Valid @RequestBody QuestionCreateRequest request) {
        return questions.create(request);
    }

    /** 실행 때 저장한 C2 argument 를 그대로 준다. */
    @GetMapping("/v1/arguments/{run_id}")
    public ResponseEntity<String> argument(@PathVariable("run_id") String runId) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(questions.argument(runId));
    }
}
