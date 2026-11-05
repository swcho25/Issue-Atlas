package com.c108.issueatlas.csvimport.dto;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public final class CsvImportDto {
    private CsvImportDto() {}

    public record Request(
            String importId,
            long requestedBy,
            long assigneeId,
            String fileName,
            String fileSha256,
            String templateVersion,
            String status,
            long revision,
            JsonNode validation,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {}

    public record Result(
            String status,
            long actorId,
            String reason,
            int loadedRows,
            int skippedRows,
            OffsetDateTime createdAt) {}

    public record Detail(Request request, Result result) {}

    public record Page(List<Request> items, long total, int page, int size) {}

    public record Finish(
            @NotNull @Min(0) Long expectedRevision,
            @NotNull @Pattern(regexp = "completed|failed") String status,
            @NotBlank @Size(max = 2000) String reason,
            @NotNull @Min(0) Integer loadedRows,
            @NotNull @Min(0) Integer skippedRows) {}

    public record Problem(long row, String column, String code) {}

    public record Validation(
            int totalRows,
            int validRows,
            int duplicateRows,
            int eligibleRows,
            int errorCount,
            boolean errorsTruncated,
            List<Problem> errors,
            List<Long> duplicateRowNumbers) {}

    public record Template(
            String templateId,
            String templateVersion,
            int maxBytes,
            int maxRows,
            List<String> columns) {}
}
