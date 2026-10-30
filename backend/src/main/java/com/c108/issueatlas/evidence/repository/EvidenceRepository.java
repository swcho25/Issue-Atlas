package com.c108.issueatlas.evidence.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class EvidenceRepository {
    private static final String FIND =
            """
            SELECT e.evidence_id, e.kind, e.title, s.name AS source_name, e.source_grade,
                   e.license_type, e.storage_scope, e.observed_at, e.period_start, e.period_end,
                   e.published_at, e.collected_at, e.location_precision, e.locator::text AS locator,
                   e.display, e.url
            FROM evidence e JOIN source s USING (source_id)
            WHERE e.evidence_id = ?
            """;

    private final JdbcClient jdbc;

    public EvidenceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<EvidenceRow> find(String evidenceId) {
        return jdbc.sql(FIND).param(evidenceId).query(EvidenceRow.class).optional();
    }

    /** locator 는 JSON 문자열 그대로. 응답에서 객체로 내보낸다. */
    public record EvidenceRow(
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
            String locator,
            String display,
            String url) {}
}
