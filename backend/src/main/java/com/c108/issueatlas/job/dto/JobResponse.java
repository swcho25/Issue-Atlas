package com.c108.issueatlas.job.dto;

import com.c108.issueatlas.job.repository.JobRepository.JobRow;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.time.OffsetDateTime;
import java.util.List;

/** C2 {@code job.schema.json#/$defs/job}. */
public record JobResponse(
        String jobRunId,
        String sourceId,
        String sourceName,
        String specId,
        String method,
        String collectorVersion,
        String status,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        Long received,
        Long inserted,
        Long duplicates,
        String errorCode,
        // 수집기가 남긴 stats 를 그대로 객체로 내보낸다
        @JsonRawValue String details) {
    public static final String SCHEMA_VERSION = "c2-0.1";

    public static JobResponse from(JobRow row) {
        return new JobResponse(
                row.jobRunId(),
                row.sourceId(),
                row.sourceName(),
                row.specId(),
                row.method(),
                row.collectorVersion(),
                row.status(),
                row.startedAt(),
                row.finishedAt(),
                row.received(),
                row.inserted(),
                row.duplicates(),
                row.errorCode(),
                row.details());
    }

    /** C2 {@code job.schema.json}. */
    public record Single(String schemaVersion, JobResponse job) {}

    /** C2 {@code job-list.schema.json}. page 는 1부터. */
    public record Page(
            String schemaVersion, List<JobResponse> jobs, int page, int size, long total) {}
}
