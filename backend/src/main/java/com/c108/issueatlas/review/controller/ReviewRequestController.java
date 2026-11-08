package com.c108.issueatlas.review.controller;

import com.c108.issueatlas.review.dto.ReviewDto.Request;
import com.c108.issueatlas.review.dto.ReviewDto.Submit;
import com.c108.issueatlas.review.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Tag(name = "questions")
@RestController
public class ReviewRequestController {
    private final ReviewService reviews;

    public ReviewRequestController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @Operation(summary = "결과 수정 제안 보내기 (로그인 필요)")
    @PostMapping("/v1/review-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public Receipt submit(@Valid @RequestBody Submit in, Principal actor) {
        Request r = reviews.submit(in, actor.getName(), false);
        return new Receipt(r.reviewId(), r.status());
    }

    public record Receipt(String reviewId, String status) {}
}
