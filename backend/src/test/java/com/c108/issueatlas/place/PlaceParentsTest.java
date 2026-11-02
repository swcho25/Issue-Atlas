package com.c108.issueatlas.place;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0021 이 이은 시군구의 상위 지역과, contracts/p3 「상위 지역 자료」의 재귀 쿼리를 확인한다. StationPlaceSeedTest 와 같은 이유로
 * {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PlaceParentsTest {
    // contracts/p3 「상위 지역 자료」와 같은 쿼리 (KOSIS 코드만, 유효 기간 없는 줄)
    private static final String UP_CODES =
            """
            WITH RECURSIVE up AS (
                SELECT place_id, parent_id, 0 AS depth FROM place WHERE place_id = ?
                UNION ALL
                SELECT p.place_id, p.parent_id, up.depth + 1 FROM place p JOIN up ON p.place_id = up.parent_id
            )
            SELECT up.depth, c.place_code
            FROM up JOIN place_code_map c ON c.place_id = up.place_id
            WHERE c.code_system = 'kosis' AND c.valid_to IS NULL
            ORDER BY up.depth, c.place_code
            """;

    @Autowired JdbcTemplate jdbc;

    @Test
    void 광주_구는_광주_전체_여수는_옛_전남_아래() {
        assertThat(
                        jdbc.queryForList(
                                "SELECT place_id, parent_id FROM place WHERE level = 'sigungu' ORDER BY place_id"))
                .containsExactly(
                        Map.of("place_id", "plc_gwangju_bukgu", "parent_id", "kr-29"),
                        Map.of("place_id", "plc_gwangju_donggu", "parent_id", "kr-29"),
                        Map.of("place_id", "plc_gwangju_gwangsangu", "parent_id", "kr-29"),
                        Map.of("place_id", "plc_gwangju_namgu", "parent_id", "kr-29"),
                        Map.of("place_id", "plc_gwangju_seogu", "parent_id", "kr-29"),
                        Map.of("place_id", "plc_yeosu", "parent_id", "kr-46"));
    }

    @Test
    void 구에서_올라가면_광주_본청_코드_29와_통합시_12가_잡힌다() {
        assertThat(jdbc.queryForList(UP_CODES, "plc_gwangju_donggu"))
                .containsExactly(
                        Map.of("depth", 0, "place_code", "12210"),
                        Map.of("depth", 1, "place_code", "29"),
                        Map.of("depth", 2, "place_code", "12"));
        assertThat(jdbc.queryForList(UP_CODES, "plc_yeosu"))
                .containsExactly(
                        Map.of("depth", 0, "place_code", "12130"),
                        Map.of("depth", 1, "place_code", "46"),
                        Map.of("depth", 2, "place_code", "12"));
    }

    @Test
    void 행정동에서도_구를_거쳐_광주_전체까지_올라간다() {
        assertThat(
                        jdbc
                                .queryForList(
                                        UP_CODES.replace(
                                                "c.code_system = 'kosis' AND c.valid_to IS NULL",
                                                "true"),
                                        "kr-12210560")
                                .stream()
                                .map(row -> row.get("place_code"))
                                .toList())
                .contains("12060560", "12210", "29", "12")
                .doesNotContain("29140");
    }
}
