package com.c108.issueatlas.evidence.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** C2 {@code evidence.schema.json}. */
public record EvidenceResponse(
        String schemaVersion,
        String evidenceId,
        String kind,
        String title,
        String sourceName,
        String sourceGrade,
        String licenseType,
        String storageScope,
        OffsetDateTime observedAt,
        LocalDate periodStart,
        LocalDate periodEnd,
        OffsetDateTime publishedAt,
        OffsetDateTime collectedAt,
        String locationPrecision,
        // DB jsonb 를 그대로 객체로 내보낸다
        @JsonRawValue String locator,
        String display,
        String url,
        String footnote) {
    public static final String SCHEMA_VERSION = "c2-0.1";
}
