package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.CardApprovalDto.*;
import com.c108.issueatlas.card.service.CardApprovalService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/admin")
public class AdminCardApprovalController {
    private final CardApprovalService approvals;

    public AdminCardApprovalController(CardApprovalService approvals) {
        this.approvals = approvals;
    }

    @PostMapping("/cards/{id}/approval-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Request submit(
            @PathVariable String id, @Valid @RequestBody Submit input, Principal actor) {
        return approvals.submit(id, input, actor.getName());
    }

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

    @GetMapping("/approval-requests/{id}")
    public Detail detail(@PathVariable String id) {
        return approvals.detail(id);
    }

    @PostMapping("/approval-requests/{id}/decisions")
    public Request decide(
            @PathVariable String id, @Valid @RequestBody Decide input, Principal actor) {
        return approvals.decide(id, input, actor.getName());
    }
}
