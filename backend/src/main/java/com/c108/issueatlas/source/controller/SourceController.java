package com.c108.issueatlas.source.controller;

import com.c108.issueatlas.source.dto.SourceListResponse;
import com.c108.issueatlas.source.service.SourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "evidence")
@RestController
@RequestMapping("/v1/sources")
public class SourceController {
    private final SourceService sources;

    public SourceController(SourceService sources) {
        this.sources = sources;
    }

    @Operation(
            operationId = "listSources",
            summary = "출처 목록 — 출처 등급 · 이용 조건 · 저장 범위와 수집 명세별 마지막 성공 수집 시각")
    @GetMapping
    public SourceListResponse list() {
        return new SourceListResponse(sources.list());
    }
}
