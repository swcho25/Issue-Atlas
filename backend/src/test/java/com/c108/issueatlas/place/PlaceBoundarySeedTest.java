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
 * V0041 · V0042 이 넣은 시군구 · 행정동 경계(SGIS 2025)를 확인한다. StationPlaceSeedTest 와 같은 이유로
 * {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PlaceBoundarySeedTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void 시군구_6곳과_행정동_123곳_모두_경계가_있다() {
        assertThat(
                        jdbc.queryForList(
                                "SELECT p.level, count(*) AS n FROM place p JOIN place_boundary b USING (place_id)"
                                        + " WHERE b.source = 'sgis_hadmarea' AND b.source_year = 2025"
                                        + " GROUP BY p.level ORDER BY p.level"))
                .containsExactly(
                        Map.of("level", "emd", "n", 123L), Map.of("level", "sigungu", "n", 6L));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place_boundary b JOIN place p USING (place_id)"
                                        + " WHERE p.level NOT IN ('sigungu', 'emd')",
                                Integer.class))
                .isZero();
    }

    @Test
    void 대표점은_자기_경계_안에_있고_행정동은_부모_시군구_안에_있다() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place p JOIN place_boundary b USING (place_id)"
                                        + " WHERE NOT ST_Covers(b.boundary::geometry, p.geometry::geometry)",
                                Integer.class))
                .isZero();
        // 경계는 따로 단순화(10 m)해 맞닿은 선이 조금 어긋난다 → 행정동 안의 한 점으로 본다
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place e JOIN place_boundary eb USING (place_id)"
                                        + " JOIN place_boundary sb ON sb.place_id = e.parent_id"
                                        + " WHERE e.level = 'emd' AND NOT ST_Covers(sb.boundary::geometry,"
                                        + " ST_PointOnSurface(eb.boundary::geometry))",
                                Integer.class))
                .isZero();
    }

    @Test
    void 측정소_22곳은_모두_한_행정동_안에_있다() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place s WHERE s.level = 'station' AND 1 = ("
                                        + "SELECT count(*) FROM place_boundary b JOIN place e USING (place_id)"
                                        + " WHERE e.level = 'emd' AND ST_Covers(b.boundary, s.geometry))",
                                Integer.class))
                .isEqualTo(22);
    }

    @Test
    void 경계_면적은_공식_면적과_비슷하다() {
        // 광주 동구 49 ㎢ · 광산구 222 ㎢ (행정구역 통계)
        assertThat(
                        jdbc.queryForObject(
                                "SELECT ST_Area(boundary) / 1e6 FROM place_boundary WHERE place_id = 'kr-12210'",
                                Double.class))
                .isBetween(47.0, 51.0);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT ST_Area(boundary) / 1e6 FROM place_boundary WHERE place_id = 'kr-12330'",
                                Double.class))
                .isBetween(218.0, 226.0);
    }
}
