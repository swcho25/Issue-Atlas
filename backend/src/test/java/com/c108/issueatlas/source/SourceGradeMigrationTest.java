package com.c108.issueatlas.source;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** V0039 출처 등급 · V0040 세출 출처 행: 등급 없이 넣은 출처 행이 표의 값으로 채워지는지. 테스트마다 되돌린다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class SourceGradeMigrationTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void collectorStyleInsertGetsGradeFromTable() {
        insert("bigkinds", null);
        insert("lofin", null);
        insert("S01", null);

        assertThat(grade("bigkinds")).isEqualTo("C");
        assertThat(grade("lofin")).isEqualTo("B");
        assertThat(grade("S01")).isEqualTo("A");
    }

    @Test
    void givenGradeAndUnknownSourceAreLeftAlone() {
        insert("bigkinds", "B");
        insert("S-grade-unknown", null);

        assertThat(grade("bigkinds")).isEqualTo("B");
        assertThat(grade("S-grade-unknown")).isNull();
    }

    @Test
    void gradeClearedAfterInsertStaysEmpty() {
        insert("lofin", null);
        jdbc.update("UPDATE source SET reliability_grade = NULL WHERE source_id = 'lofin'");

        assertThat(grade("lofin")).isNull();
    }

    @Test
    void lofinMigrationAddsCollectorRowOnceWithGradeB() throws Exception {
        // 다른 테스트가 출처 표를 비울 수 있어 V0040 을 이 트랜잭션 안에서 다시 돌려 본다
        String v0040 =
                Files.readString(
                        Path.of("src/main/resources/db/migration/V0040__add_lofin_source.sql"));
        jdbc.update("DELETE FROM source WHERE source_id = 'lofin'");
        jdbc.execute(v0040);
        jdbc.update("UPDATE source SET name = '바꾼 이름' WHERE source_id = 'lofin'");
        jdbc.execute(v0040);

        assertThat(
                        jdbc.queryForMap(
                                "SELECT name, license_type, storage_scope, reliability_grade"
                                        + " FROM source WHERE source_id = 'lofin'"))
                .containsEntry("name", "바꾼 이름")
                .containsEntry("license_type", "공공데이터-이용허락범위제한없음")
                .containsEntry("storage_scope", "full")
                .containsEntry("reliability_grade", "B");
    }

    private void insert(String id, String grade) {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES (?, '출처', '기관', 'KOGL-1', 'full', ?)",
                id,
                grade);
    }

    private String grade(String id) {
        return jdbc.queryForObject(
                "SELECT reliability_grade FROM source WHERE source_id = ?", String.class, id);
    }
}
