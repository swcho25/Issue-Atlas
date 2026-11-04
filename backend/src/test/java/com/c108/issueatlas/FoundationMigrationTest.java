package com.c108.issueatlas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class FoundationMigrationTest {
    private final JdbcTemplate jdbc;
    private final Flyway flyway;

    FoundationMigrationTest(@Autowired JdbcTemplate jdbc, @Autowired Flyway flyway) {
        this.jdbc = jdbc;
        this.flyway = flyway;
    }

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM raw_record");
        jdbc.update("DELETE FROM job_run");
        jdbc.update("DELETE FROM source_spec");
        jdbc.update("DELETE FROM source");
        jdbc.update("DELETE FROM place_code_map");
        jdbc.update("DELETE FROM place_boundary");
        jdbc.update("UPDATE place SET parent_id = NULL");
        jdbc.update("DELETE FROM place");
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope) VALUES ('S-test','test','test','test','full')");
        for (String spec : new String[] {"SP-test", "SP-other"}) {
            jdbc.update(
                    "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES (?, 'S-test','file','statistics')",
                    spec);
        }
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at) VALUES ('run-test','SP-test','test',TIMESTAMPTZ '2026-10-21 11:00:00+09')");
        jdbc.update("INSERT INTO place(place_id,name,level) VALUES ('yeosu-test','여수시','sigungu')");
    }

    @Test
    void emptyDatabaseMigratesAndSecondMigrationIsNoOp() {
        // V0002 가 적용됐는지만 본다. 「가장 최근 버전 = 2」로 검사하면 뒤에 마이그레이션이 붙는 순간 깨진다
        assertThat(flyway.info().applied())
                .anySatisfy(
                        migration ->
                                assertThat(migration.getVersion())
                                        .isEqualTo(MigrationVersion.fromVersion("2")));
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('source','source_spec','job_run','raw_record','place','place_code_map')",
                                Integer.class))
                .isEqualTo(6);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='place' AND indexdef LIKE '%USING gist%'",
                                Integer.class))
                .isEqualTo(1);
    }

    @Test
    void pgvectorExtensionIsEnabled() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
                                String.class))
                .isEqualTo("0.8.7");
    }

    @Test
    void nullHashesAndMetadataOnlyPayloadCanBeStored() {
        jdbc.update("UPDATE source SET storage_scope='metadata' WHERE source_id='S-test'");
        insertRaw("SP-test", "first.xlsx", null);
        insertRaw("SP-test", "second.xlsx", null);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM raw_record WHERE content_hash IS NULL AND payload IS NULL",
                                Integer.class))
                .isEqualTo(2);
    }

    @Test
    void duplicateContentHashIsRejected() {
        insertRaw("SP-test", "first.xlsx", "hash-test");
        assertThatThrownBy(() -> insertRaw("SP-test", "second.xlsx", "hash-test"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void missingOriginIsRejected() {
        assertThatThrownBy(() -> insertRaw("SP-test", null, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rawRecordCannotReferenceDifferentSpecFromItsRun() {
        assertThatThrownBy(() -> insertRaw("SP-other", "sample.xlsx", null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void invalidSourceAndJsonParametersAreRejected() {
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO source_spec(spec_id,source_id,method,evidence_class) VALUES ('bad','missing','api','statistics')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE source_spec SET params='[]'::jsonb WHERE spec_id='SP-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE source SET storage_scope='unknown' WHERE source_id='S-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void executionCompletionAndTimeAreConsistent() {
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE job_run SET status='ok' WHERE job_run_id='run-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE job_run SET status='ok',finished_at=TIMESTAMPTZ '2026-10-20 00:00:00+09' WHERE job_run_id='run-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update(
                "UPDATE job_run SET status='ok',finished_at=TIMESTAMPTZ '2026-10-21 12:00:00+09' WHERE job_run_id='run-test'");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT started_at=TIMESTAMPTZ '2026-10-21 02:00:00Z' FROM job_run WHERE job_run_id='run-test'",
                                Boolean.class))
                .isTrue();
    }

    @Test
    void actualStationPointUsesLongitudeThenLatitude() {
        jdbc.update(
                "INSERT INTO place(place_id,name,level,parent_id,geometry,location_precision,geometry_role) VALUES ('station-test','서강동','station','yeosu-test',ST_SetSRID(ST_Point(127.725967,34.741301),4326)::geography,'exact','station')");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT ST_X(geometry::geometry) FROM place WHERE place_id='station-test'",
                                BigDecimal.class))
                .isEqualByComparingTo("127.725967");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT ST_Y(geometry::geometry) FROM place WHERE place_id='station-test'",
                                BigDecimal.class))
                .isEqualByComparingTo("34.741301");
    }

    @Test
    void invalidPrecisionCoordinatesAndParentAreRejected() {
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE place SET location_precision='exact' WHERE place_id='yeosu-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE place SET geometry=ST_SetSRID(ST_Point(130,40),4326)::geography WHERE place_id='yeosu-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE place SET parent_id=place_id WHERE place_id='yeosu-test'"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void oldAndNewKosisCodesPointToSamePlace() {
        jdbc.update(
                "INSERT INTO place_code_map(place_id,code_system,place_code,valid_to) VALUES ('yeosu-test','kosis','46130',DATE '2026-06-30')");
        jdbc.update(
                "INSERT INTO place_code_map(place_id,code_system,place_code,valid_from) VALUES ('yeosu-test','kosis','12130',DATE '2026-07-01')");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(DISTINCT place_id) FROM place_code_map WHERE place_code IN ('46130','12130')",
                                Integer.class))
                .isEqualTo(1);
        jdbc.update(
                "INSERT INTO place_code_map(place_id,code_system,place_code) VALUES ('yeosu-test','airkorea_station_name','서강동-test')");
    }

    @Test
    void duplicateUnknownStartAndReversedDatesAreRejected() {
        jdbc.update(
                "INSERT INTO place_code_map(place_id,code_system,place_code) VALUES ('yeosu-test','kosis','46130')");
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO place_code_map(place_id,code_system,place_code) VALUES ('yeosu-test','kosis','46130')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO place_code_map(place_id,code_system,place_code,valid_from,valid_to) VALUES ('yeosu-test','kosis','12130',DATE '2026-07-02',DATE '2026-07-01')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void insertRaw(String spec, String fileName, String hash) {
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,file_name,content_hash,collected_at) VALUES ('run-test',?,?,?,TIMESTAMPTZ '2026-10-21 11:30:00+09')",
                spec,
                fileName,
                hash);
    }
}
