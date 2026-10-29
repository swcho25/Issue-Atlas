package com.c108.issueatlas.evidence.controller;

import com.c108.issueatlas.evidence.dto.EvidenceResponse;
import com.c108.issueatlas.evidence.service.EvidenceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/evidence")
public class EvidenceController {
    private final EvidenceService evidence;

    public EvidenceController(EvidenceService evidence) {
        this.evidence = evidence;
    }

    @GetMapping("/{evidenceId}")
    public EvidenceResponse get(@PathVariable String evidenceId) {
        return evidence.get(evidenceId);
    }
}
