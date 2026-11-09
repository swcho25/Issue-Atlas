package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.CardApprovalDto.*;
import com.c108.issueatlas.card.service.CardApprovalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Tag(name = "admin")
@RestController
@RequestMapping("/v1/admin")
public class AdminCardApprovalController {
    private final CardApprovalService approvals;

    public AdminCardApprovalController(CardApprovalService approvals) {
        this.approvals = approvals;
    }

    @Operation(summary = "카드 초안 승인 요청 (승인자 지정)")
    @PostMapping("/cards/{id}/approval-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Request submit(
            @PathVariable String id, @Valid @RequestBody Submit input, Principal actor) {
        return approvals.submit(id, input, actor.getName());
    }

    @Operation(summary = "승인 요청 목록 (상태 · 카드 · 승인자 · 요청자 필터)")
    @GetMapping("/approval-requests")
    public Page list(
            @RequestParam(required = false) String status,
            @RequestParam(name = "card_id", required = false) String card,
            @RequestParam(name = "approver_id", required = false) Long approver,
            @RequestParam(name = "requested_by", required = false) Long requester,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return approvals.list(status, card, approver, requester, page, size);
    }

    @Operation(summary = "승인 요청 상세 (요청 당시 초안 · 지표 판 · 결정 이력)")
    @GetMapping("/approval-requests/{id}")
    public Detail detail(@PathVariable String id) {
        return approvals.detail(id);
    }

    @Operation(summary = "승인 요청 처리 (승인 · 반려 · 보류, 사유 필수)")
    @PostMapping("/approval-requests/{id}/decisions")
    public Request decide(
            @PathVariable String id, @Valid @RequestBody Decide input, Principal actor) {
        return approvals.decide(id, input, actor.getName());
    }
}
