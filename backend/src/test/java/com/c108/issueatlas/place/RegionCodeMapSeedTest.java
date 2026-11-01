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
 * V0018 이 이은 지역 코드(시도 2자리 · 광주 전체 29 · 온통청년 bjd · 측정소 이름)와 시도 place 18곳을 확인한다. StationPlaceSeedTest
 * 와 같은 이유로 {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RegionCodeMapSeedTest {
    // 코드 하나가 가리키는 place (유효 기간은 보지 않는다 — 이 시드의 코드는 기간이 겹치지 않는다)
    private static final String PLACE_OF =
            "SELECT place_id FROM place_code_map WHERE code_system = ? AND place_code = ?";

    @Autowired JdbcTemplate jdbc;

    @Test
    void 시도_place_18곳은_kr_코드와_시도_대표점() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place WHERE level = 'sido' AND starts_with(place_id, 'kr-')"
                                        + " AND location_precision = 'admin_centroid' AND geometry IS NOT NULL",
                                Integer.class))
                .isEqualTo(18);
        assertThat(
                        jdbc.queryForList(
                                "SELECT place_id, parent_id, attrs ->> 'sido' AS sido, attrs ->> 'sigun' AS sigun"
                                        + " FROM place WHERE place_id IN ('kr-12', 'kr-29', 'kr-44') ORDER BY place_id"))
                .containsExactly(
                        row("kr-12", null, "전남광주통합특별시", null),
                        row("kr-29", "kr-12", "전남광주통합특별시", "광주"),
                        row("kr-44", null, "충남", null));
        // 인천은 시청 위치(구월동), SGIS 시도 중심(강화도)이 아니다
        assertThat(
                        jdbc.queryForObject(
                                "SELECT round(ST_Y(geometry::geometry)::numeric, 2) FROM place WHERE place_id = 'kr-28'",
                                Double.class))
                .isEqualTo(37.46);
    }

    @Test
    void SP02_도착_시도_17곳과_광주_전체_29가_시도_place_로() {
        List<String> c2 =
                List.of(
                        "11", "26", "27", "28", "29", "30", "31", "36", "41", "43", "44", "46",
                        "47", "48", "50", "51", "52");
        for (String code : c2) {
            assertThat(jdbc.queryForList(PLACE_OF, String.class, "kosis", code))
                    .as("kosis %s", code)
                    .containsExactly("kr-" + code);
        }
        assertThat(jdbc.queryForList(PLACE_OF, String.class, "kosis", "12"))
                .containsExactly("kr-12");
    }

    @Test
    void 온통청년_bjd_코드는_KOSIS_새_코드와_같은_시군구로() {
        for (String code : List.of("12130", "12210", "12240", "12270", "12300", "12330")) {
            assertThat(jdbc.queryForList(PLACE_OF, String.class, "bjd", code))
                    .as("bjd %s", code)
                    .isEqualTo(jdbc.queryForList(PLACE_OF, String.class, "kosis", code))
                    .hasSize(1);
        }
    }

    @Test
    void 측정소_이름은_괄호까지_그대로_측정소_코드와_같은_place() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place_code_map n"
                                        + " JOIN place_code_map c ON c.place_id = n.place_id AND c.code_system = 'airkorea_station'"
                                        + " WHERE n.code_system = 'airkorea_station_name'",
                                Integer.class))
                .isEqualTo(22);
        assertThat(jdbc.queryForList(PLACE_OF, String.class, "airkorea_station_name", "우산동(광주)"))
                .hasSize(1);
        assertThat(jdbc.queryForList(PLACE_OF, String.class, "airkorea_station_name", "우산동"))
                .isEmpty();
    }

    private static Map<String, Object> row(
            String placeId, String parentId, String sido, String sigun) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("place_id", placeId);
        m.put("parent_id", parentId);
        m.put("sido", sido);
        m.put("sigun", sigun);
        return m;
    }
}
