package com.c108.issueatlas.source.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** C2 {@code source-list.schema.json}. */
public record SourceListResponse(String schemaVersion, List<SourceResponse> sources) {
    public static final String SCHEMA_VERSION = "c2-0.1";

    public SourceListResponse(List<SourceResponse> sources) {
        this(SCHEMA_VERSION, sources);
    }

    /** source_grade 는 출처 등급을 아직 정하지 않았으면 null. */
    public record SourceResponse(
            String sourceId,
            String name,
            String org,
            String licenseType,
            String storageScope,
            String sourceGrade,
            List<SpecResponse> specs) {}

    /** last_success_at 은 한 번도 성공하지 않았으면 null. */
    public record SpecResponse(
            String specId, String method, String evidenceKind, OffsetDateTime lastSuccessAt) {}
}
