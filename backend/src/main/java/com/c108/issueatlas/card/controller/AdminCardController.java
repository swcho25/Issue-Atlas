package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.CardStorageDto.*;
import com.c108.issueatlas.card.service.CardApprovalService;
import com.c108.issueatlas.card.service.CardStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** 권한은 기존 /v1/admin/** 보안 필터에서 검사한다. 승인자는 인증된 세션에서만 얻는다. */
@Tag(name = "admin")
@RestController
@RequestMapping("/v1/admin")
public class AdminCardController {
    private final CardStorageService storage;
    private final CardApprovalService approvals;

    public AdminCardController(CardStorageService storage, CardApprovalService approvals) {
        this.storage = storage;
        this.approvals = approvals;
    }

    @Operation(summary = "카드 후보 만들기")
    @PostMapping("/cards")
    @ResponseStatus(HttpStatus.CREATED)
    public CardDraft create(@Valid @RequestBody CreateCard request, Principal actor) {
        return storage.create(request, actor.getName());
    }

    @Operation(summary = "카드 초안 보기")
    @GetMapping("/cards/{id}/draft")
    public CardDraft draft(@PathVariable String id) {
        return storage.draft(id);
    }

    @Operation(summary = "카드 초안 저장 (expected_revision 으로 동시 수정을 막는다)")
    @PutMapping("/cards/{id}/draft")
    public CardDraft save(
            @PathVariable String id, @Valid @RequestBody SaveDraft request, Principal actor) {
        return storage.saveDraft(id, request, actor.getName());
    }

    @Operation(summary = "카드 초안 검증 결과")
    @GetMapping("/cards/{id}/checks")
    public Validation check(@PathVariable String id) {
        return storage.check(id);
    }

    @Operation(summary = "카드 초안 승인 → 새 판 (열린 승인 요청 · 지정 승인자 필요)")
    @PostMapping("/cards/{id}/approvals")
    @ResponseStatus(HttpStatus.CREATED)
    public Version approve(
            @PathVariable String id, @Valid @RequestBody Approve request, Principal actor) {
        return approvals.approveCurrent(id, request, actor.getName());
    }

    @Operation(summary = "카드 승인본 한 판")
    @GetMapping("/cards/{id}/versions/{version}")
    public Version version(@PathVariable String id, @PathVariable int version) {
        return storage.version(id, version);
    }

    @Operation(summary = "카드 판 이력")
    @GetMapping("/cards/{id}/revisions")
    public List<Revision> revisions(@PathVariable String id) {
        return storage.revisions(id);
    }

    @Operation(summary = "지표 정의 · 판정 규칙 보기")
    @GetMapping("/indicators/{id}")
    public Indicator indicator(@PathVariable String id) {
        return storage.indicator(id);
    }

    @Operation(summary = "지표 정의 · 판정 규칙 저장 (expected_rule_version, 처음은 0)")
    @PutMapping("/indicators/{id}")
    public Indicator saveIndicator(
            @PathVariable String id, @Valid @RequestBody SaveIndicator request, Principal actor) {
        return storage.saveIndicator(id, request, actor.getName());
    }
}
