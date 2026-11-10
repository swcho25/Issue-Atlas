package com.c108.issueatlas.place;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0019 가 넣은 행정동 123곳과 SGIS 행정동 코드를 확인한다. StationPlaceSeedTest 와 같은 이유로
 * {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EmdPlaceSeedTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void 시군구_6곳_아래_행정동_123곳() {
        assertThat(
                        jdbc.queryForList(
                                "SELECT parent_id, count(*) AS n FROM place WHERE level = 'emd'"
                                        + " AND location_precision = 'admin_centroid' AND geometry IS NOT NULL"
                                        + " GROUP BY parent_id ORDER BY parent_id"))
                .containsExactly(
                        Map.of("parent_id", "kr-12130", "n", 27L),
                        Map.of("parent_id", "kr-12210", "n", 13L),
                        Map.of("parent_id", "kr-12240", "n", 18L),
                        Map.of("parent_id", "kr-12270", "n", 17L),
                        Map.of("parent_id", "kr-12300", "n", 27L),
                        Map.of("parent_id", "kr-12330", "n", 21L));
    }

    @Test
    void place_id는_KOSIS_새_시군구_코드로_시작하고_attrs는_부모_지역에_행정동_이름() {
        // 부모 시군구의 KOSIS 새 코드(12210 …) 뒤에 읍면동 3자리
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place e JOIN place_code_map k ON k.place_id = e.parent_id"
                                        + " AND k.code_system = 'kosis' AND k.valid_from = DATE '2026-07-01'"
                                        + " WHERE e.level = 'emd' AND e.place_id = 'kr-' || k.place_code || right(e.place_id, 3)",
                                Integer.class))
                .isEqualTo(123);
        assertThat(
                        jdbc.queryForMap(
                                "SELECT name, attrs ->> 'sido' AS sido, attrs ->> 'sigun' AS sigun,"
                                        + " attrs ->> 'gu' AS gu, attrs ->> 'emd' AS emd FROM place WHERE place_id = 'kr-12210560'"))
                .containsExactlyEntriesOf(row("계림1동", "전남광주통합특별시", "광주", "동구", "계림1동"));
        assertThat(
                        jdbc.queryForMap(
                                "SELECT name, attrs ->> 'sido' AS sido, attrs ->> 'sigun' AS sigun,"
                                        + " attrs ->> 'gu' AS gu, attrs ->> 'emd' AS emd FROM place WHERE place_id = 'kr-12130110'"))
                .containsExactlyEntriesOf(row("돌산읍", "전남광주통합특별시", "여수시", null, "돌산읍"));
    }

    @Test
    void SGIS_코드는_통합_전_뒤_두_줄이고_같은_행정동을_가리킨다() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place_code_map WHERE code_system = 'sgis'",
                                Integer.class))
                .isEqualTo(246);
        assertThat(
                        jdbc.queryForList(
                                "SELECT place_code, valid_from::text AS valid_from, valid_to::text AS valid_to"
                                        + " FROM place_code_map WHERE code_system = 'sgis' AND place_id = 'kr-12210560'"
                                        + " ORDER BY valid_from NULLS FIRST"))
                .containsExactly(
                        codeRow("24010560", null, "2026-06-30"),
                        codeRow("12060560", "2026-07-01", null));
        // 같은 이름의 행정동(우산동: 북구 · 광산구)은 코드로 갈린다
        assertThat(
                        jdbc.queryForList(
                                "SELECT p.parent_id FROM place p JOIN place_code_map c ON c.place_id = p.place_id"
                                        + " WHERE c.code_system = 'sgis' AND c.valid_from IS NOT NULL AND p.name = '우산동'"
                                        + " ORDER BY 1",
                                String.class))
                .isEqualTo(List.of("kr-12300", "kr-12330"));
    }

    private static Map<String, Object> row(
            String name, String sido, String sigun, String gu, String emd) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("name", name);
        m.put("sido", sido);
        m.put("sigun", sigun);
        m.put("gu", gu);
        m.put("emd", emd);
        return m;
    }

    private static Map<String, Object> codeRow(String code, String from, String to) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("place_code", code);
        m.put("valid_from", from);
        m.put("valid_to", to);
        return m;
    }
}
