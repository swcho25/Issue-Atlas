package com.c108.issueatlas.source;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** V0039 출처 등급: 수집기처럼 등급 없이 넣은 출처 행이 표의 값으로 채워지는지. 테스트마다 되돌린다. */
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
