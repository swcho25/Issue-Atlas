package com.c108.issueatlas.source.repository;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 수집기가 채운 source · source_spec · job_run 을 읽기만 한다. */
@Repository
public class SourceRepository {
    // 출처 하나에 명세 여러 줄. 명세가 없는 출처는 spec_id 가 null 인 한 줄
    private static final String SOURCE_SPECS =
            """
            SELECT s.source_id, s.name, s.org, s.license_type, s.storage_scope, s.reliability_grade,
                   ss.spec_id, ss.method, ss.evidence_class,
                   (SELECT max(j.finished_at) FROM job_run j
                     WHERE j.spec_id = ss.spec_id AND j.status = 'ok') AS last_success_at
            FROM source s LEFT JOIN source_spec ss USING (source_id)
            ORDER BY s.source_id, ss.spec_id
            """;

    private final JdbcClient jdbc;

    public SourceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<SourceSpecRow> findSourceSpecs() {
        return jdbc.sql(SOURCE_SPECS).query(SourceSpecRow.class).list();
    }

    public record SourceSpecRow(
            String sourceId,
            String name,
            String org,
            String licenseType,
            String storageScope,
            String reliabilityGrade,
            String specId,
            String method,
            String evidenceClass,
            OffsetDateTime lastSuccessAt) {}
}
