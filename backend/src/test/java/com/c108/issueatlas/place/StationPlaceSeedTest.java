package com.c108.issueatlas.place;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0017 이 넣은 측정소 22곳 · 시군구 6곳 위치와 contracts/p3 「지역 맞추기」 쿼리를 확인한다. FoundationMigrationTest 는 place 를
 * 비우므로 PlaceApiTest 와 같이 {@code @AutoConfigureMockMvc} 를 두어 같은 컨텍스트(DB)를 쓰지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class StationPlaceSeedTest {
    // contracts/p3 README 「지역 맞추기」와 같은 쿼리
    private static final String MATCH_NEWS =
            """
            SELECT e.news_id
            FROM news_event e
            JOIN place p ON p.place_id = ?
            WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(e.regions) r
                WHERE r ->> 'sido' = p.attrs ->> 'sido'
                  AND (r ->> 'sigun' IS NULL OR r ->> 'sigun' = p.attrs ->> 'sigun')
                  AND (r ->> 'gu' IS NULL OR r ->> 'gu' = p.attrs ->> 'gu'))
            ORDER BY e.news_id
            """;

    @Autowired JdbcTemplate jdbc;

    @Test
    void 측정소는_시군구_아래에_코드_하나씩() {
        Map<String, Long> perParent =
                jdbc
                        .queryForList(
                                "SELECT parent_id, count(*) AS n FROM place"
                                        + " WHERE starts_with(place_id, 'plc_stn_') GROUP BY parent_id")
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        row -> (String) row.get("parent_id"),
                                        row -> (Long) row.get("n")));
        assertThat(perParent)
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of(
                                "kr-12130", 9L,
                                "kr-12210", 1L,
                                "kr-12240", 3L,
                                "kr-12270", 2L,
                                "kr-12300", 4L,
                                "kr-12330", 3L));
        // 측정소마다 exact 좌표와 air_monthly.station_code 로 쓰는 코드 하나
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place s"
                                        + " JOIN place_code_map c ON c.place_id = s.place_id AND c.code_system = 'airkorea_station'"
                                        + " WHERE starts_with(s.place_id, 'plc_stn_') AND s.level = 'station'"
                                        + " AND s.location_precision = 'exact' AND s.geometry_role = 'station'"
                                        + " AND s.geometry IS NOT NULL AND s.place_id = 'plc_stn_' || c.place_code"
                                        + " AND c.valid_from IS NULL AND c.valid_to IS NULL",
                                Integer.class))
                .isEqualTo(22);
        assertThat(
                        jdbc.queryForList(
                                "SELECT ST_X(geometry::geometry) AS lon, ST_Y(geometry::geometry) AS lat,"
                                        + " attrs ->> 'address' AS address FROM place WHERE place_id = 'plc_stn_336121'"))
                .containsExactly(
                        Map.of(
                                "lon", 127.725967,
                                "lat", 34.741301,
                                "address", "전남광주통합특별시 여수시 서교1길 28-1 서강동주민자치센터 (서교동)"));
    }

    @Test
    void 시군구는_행정_중심_좌표와_기사_지역_칸() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM place WHERE level = 'sigungu'"
                                        + " AND location_precision = 'admin_centroid' AND geometry IS NOT NULL"
                                        + " AND attrs ->> 'sido' = '전남광주통합특별시'",
                                Integer.class))
                .isEqualTo(6);
        assertThat(
                        jdbc.queryForList(
                                "SELECT place_id, attrs ->> 'sigun' AS sigun, coalesce(attrs ->> 'gu', '-') AS gu"
                                        + " FROM place WHERE place_id IN ('kr-12130', 'kr-12210')"
                                        + " ORDER BY place_id"))
                .containsExactly(
                        Map.of("place_id", "kr-12130", "sigun", "여수시", "gu", "-"),
                        Map.of("place_id", "kr-12210", "sigun", "광주", "gu", "동구"));
    }

    @Test
    void 기사는_고른_지역과_그_위_단위만_맞는다() {
        news("n1-donggu", "전남광주통합특별시", "광주", "동구");
        news("n2-gwangju", "전남광주통합특별시", "광주", null);
        news("n3-sido", "전남광주통합특별시", null, null);
        news("n4-seogu", "전남광주통합특별시", "광주", "서구");
        news("n5-yeosu", "전남광주통합특별시", "여수시", null);
        news("n6-nation", "전국", null, null);

        assertThat(match("kr-12210")).containsExactly("n1-donggu", "n2-gwangju", "n3-sido");
        assertThat(match("kr-12130")).containsExactly("n3-sido", "n5-yeosu");
    }

    private void news(String newsId, String sido, String sigun, String gu) {
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,time_precision,sido,sigun,gu,regions)"
                        + " VALUES (?,TIMESTAMPTZ '2023-01-09 00:00:00+09','published',?,?,?,"
                        + " jsonb_build_array(jsonb_build_object('sido', ?::text, 'sigun', ?::text, 'gu', ?::text)))",
                newsId,
                sido,
                sigun,
                gu,
                sido,
                sigun,
                gu);
    }

    private List<String> match(String placeId) {
        return jdbc.queryForList(MATCH_NEWS, String.class, placeId);
    }
}
