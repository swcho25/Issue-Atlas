package com.c108.issueatlas.review.controller;

import com.c108.issueatlas.review.dto.ReviewDto.*;
import com.c108.issueatlas.review.repository.ReviewRepository.ChangeFilter;
import com.c108.issueatlas.review.repository.ReviewRepository.Filter;
import com.c108.issueatlas.review.service.ReviewService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/admin")
public class AdminReviewController {
    private final ReviewService reviews;

    public AdminReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @PostMapping("/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public Request submit(@Valid @RequestBody Submit in, Principal actor) {
        return reviews.submit(in, actor.getName(), true);
    }

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

    @GetMapping("/reviews/{id}")
    public Detail detail(@PathVariable String id) {
        return reviews.detail(id);
    }

    @PostMapping("/reviews/{id}/decisions")
    public Request decide(@PathVariable String id, @Valid @RequestBody Decide in, Principal actor) {
        return reviews.decide(id, in, actor.getName());
    }

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

    @GetMapping("/changes/{id}")
    public Change change(@PathVariable String id) {
        return reviews.change(id);
    }
}
