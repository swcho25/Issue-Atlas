package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.CardStorageDto.*;
import com.c108.issueatlas.card.service.CardStorageService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** 권한은 기존 /v1/admin/** 보안 필터에서 검사한다. 승인자는 인증된 세션에서만 얻는다. */
@RestController
@RequestMapping("/v1/admin")
public class AdminCardController {
    private final CardStorageService storage;

    public AdminCardController(CardStorageService storage) {
        this.storage = storage;
    }

    @PostMapping("/cards")
    @ResponseStatus(HttpStatus.CREATED)
    public CardDraft create(@Valid @RequestBody CreateCard request, Principal actor) {
        return storage.create(request, actor.getName());
    }

    @GetMapping("/cards/{id}/draft")
    public CardDraft draft(@PathVariable String id) {
        return storage.draft(id);
    }

    @PutMapping("/cards/{id}/draft")
    public CardDraft save(
            @PathVariable String id, @Valid @RequestBody SaveDraft request, Principal actor) {
        return storage.saveDraft(id, request, actor.getName());
    }

    @GetMapping("/cards/{id}/checks")
    public Validation check(@PathVariable String id) {
        return storage.check(id);
    }

    @PostMapping("/cards/{id}/approvals")
    @ResponseStatus(HttpStatus.CREATED)
    public Version approve(
            @PathVariable String id, @Valid @RequestBody Approve request, Principal actor) {
        return storage.approve(id, request, actor.getName());
    }

    @GetMapping("/cards/{id}/versions/{version}")
    public Version version(@PathVariable String id, @PathVariable int version) {
        return storage.version(id, version);
    }

    @GetMapping("/cards/{id}/revisions")
    public List<Revision> revisions(@PathVariable String id) {
        return storage.revisions(id);
    }

    @GetMapping("/indicators/{id}")
    public Indicator indicator(@PathVariable String id) {
        return storage.indicator(id);
    }

    @PutMapping("/indicators/{id}")
    public Indicator saveIndicator(
            @PathVariable String id, @Valid @RequestBody SaveIndicator request, Principal actor) {
        return storage.saveIndicator(id, request, actor.getName());
    }
}
