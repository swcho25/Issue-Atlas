package com.c108.issueatlas.source.controller;

import com.c108.issueatlas.source.dto.SourceListResponse;
import com.c108.issueatlas.source.service.SourceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/sources")
public class SourceController {
    private final SourceService sources;

    public SourceController(SourceService sources) {
        this.sources = sources;
    }

    @GetMapping
    public SourceListResponse list() {
        return new SourceListResponse(sources.list());
    }
}
