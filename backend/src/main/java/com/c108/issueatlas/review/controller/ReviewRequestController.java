package com.c108.issueatlas.review.controller;

import com.c108.issueatlas.review.dto.ReviewDto.Request;
import com.c108.issueatlas.review.dto.ReviewDto.Submit;
import com.c108.issueatlas.review.service.ReviewService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReviewRequestController {
    private final ReviewService reviews;

    public ReviewRequestController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @PostMapping("/v1/review-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Receipt submit(@Valid @RequestBody Submit in, Principal actor) {
        Request r = reviews.submit(in, actor.getName(), false);
        return new Receipt(r.reviewId(), r.status());
    }

    public record Receipt(String reviewId, String status) {}
}
