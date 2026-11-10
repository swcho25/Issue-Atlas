package com.c108.issueatlas.evidence.controller;

import com.c108.issueatlas.evidence.dto.EvidenceResponse;
import com.c108.issueatlas.evidence.service.EvidenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "evidence")
@RestController
@RequestMapping("/v1/evidence")
public class EvidenceController {
    private final EvidenceService evidence;

    public EvidenceController(EvidenceService evidence) {
        this.evidence = evidence;
    }

    @Operation(operationId = "getEvidence", summary = "근거 상세 (출처 등급·시점·이용 조건·원문·각주)")
    @GetMapping("/{evidence_id}")
    public EvidenceResponse get(@PathVariable("evidence_id") String evidenceId) {
        return evidence.get(evidenceId);
    }
}
