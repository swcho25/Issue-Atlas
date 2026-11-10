package com.c108.issueatlas.review.controller;

import com.c108.issueatlas.review.dto.ReviewDto.*;
import com.c108.issueatlas.review.repository.ReviewRepository.ChangeFilter;
import com.c108.issueatlas.review.repository.ReviewRepository.Filter;
import com.c108.issueatlas.review.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Tag(name = "admin")
@RestController
@RequestMapping("/v1/admin")
public class AdminReviewController {
    private final ReviewService reviews;

    public AdminReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @Operation(summary = "검수 등록 (관리자)")
    @PostMapping("/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public Request submit(@Valid @RequestBody Submit in, Principal actor) {
        return reviews.submit(in, actor.getName(), true);
    }

    @Operation(summary = "검수 목록 (상태 · 출처 · 대상 · 유형 · 카드 · 검색어 필터)")
    @GetMapping("/reviews")
    public Page<Request> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String origin,
            @RequestParam(name = "target_type", required = false) String type,
            @RequestParam(name = "issue_type", required = false) String issue,
            @RequestParam(name = "card_id", required = false) String card,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return reviews.list(new Filter(status, origin, type, issue, card, q), page, size);
    }

    @Operation(summary = "검수 상세 (요청 당시 값 · 현재 값 · 수정 제안 · 이력)")
    @GetMapping("/reviews/{id}")
    public Detail detail(@PathVariable String id) {
        return reviews.detail(id);
    }

    @Operation(summary = "검수 처리 (사유 필수)")
    @PostMapping("/reviews/{id}/decisions")
    public Request decide(@PathVariable String id, @Valid @RequestBody Decide in, Principal actor) {
        return reviews.decide(id, in, actor.getName());
    }

    @Operation(summary = "변경 이력 (검수 처리 + 카드 승인)")
    @GetMapping("/changes")
    public Page<Change> changes(
            @RequestParam(name = "target_type", required = false) String type,
            @RequestParam(name = "target_id", required = false) String target,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String action,
            @RequestParam(name = "actor_id", required = false) Long actor,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return reviews.changes(
                new ChangeFilter(type, target, scope, action, actor, from, to), page, size);
    }

    @Operation(summary = "변경 이력 한 건 (처리자 · 사유 · 변경 전후)")
    @GetMapping("/changes/{id}")
    public Change change(@PathVariable String id) {
        return reviews.change(id);
    }
}
