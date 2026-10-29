package com.c108.issueatlas.observation;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 가상 지역 · 측정소 · 월 값으로 확인한다. 실제 측정소 좌표 적재는 담당 확인 뒤(S15P31C108-135).
 *
 * <p>측정소 b 는 2024-02 부터 코드가 바뀐다(T002 → T003). 측정소 d 는 좌표가 없고, x 는 다른 지역이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ObservationApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM air_monthly WHERE station_code LIKE 'T0%'");
        jdbc.update("DELETE FROM place_code_map WHERE place_id LIKE 'obs_%'");
        jdbc.update("DELETE FROM place WHERE place_id LIKE 'obs_stn_%'");
        jdbc.update("DELETE FROM place WHERE place_id LIKE 'obs_%'");
        jdbc.update(
                "INSERT INTO place(place_id,name,level) VALUES ('obs_city','가상시','sigungu'),"
                        + " ('obs_other','다른시','sigungu')");
        station("obs_stn_a", "가동", "obs_city", 127.725967, 34.741301);
        station("obs_stn_b", "나동", "obs_city", 127.731933, 34.850083);
        station("obs_stn_e", "마동", "obs_city", 127.732612, 34.738486);
        station("obs_stn_x", "다른동", "obs_other", 126.9, 35.15);
        jdbc.update(
                "INSERT INTO place(place_id,name,level,parent_id) VALUES"
                        + " ('obs_stn_d','좌표없음','station','obs_city')");
        code("obs_stn_a", "T001", null, null);
        code("obs_stn_b", "T002", null, "2024-01-31");
        code("obs_stn_b", "T003", "2024-02-01", null);
        code("obs_stn_e", "T004", null, null);
        code("obs_stn_x", "T005", null, null);
        code("obs_stn_d", "T006", null, null);
        month("T001", "2024-01-01", 17.5);
        month("T001", "2024-02-01", null);
        month("T001", "2024-03-01", 30.0); // 기간 밖
        month("T002", "2024-01-01", 20.0);
        month("T002", "2024-02-01", 99.0); // 코드 유효 기간 밖
        month("T003", "2024-02-01", 9.0);
        month("T005", "2024-01-01", 50.0); // 다른 지역
        month("T006", "2024-01-01", 60.0); // 좌표 없음
    }

    @Test
    @WithMockUser
    void A3_는_지역_측정소의_달마다_점_하나() throws Exception {
        mvc.perform(observations("obs_city", "A3", "2024-01-01", "2024-03-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schema_version").value("c2-0.1"))
                .andExpect(jsonPath("$.type").value("FeatureCollection"))
                .andExpect(jsonPath("$.legend_text").value("측정소 값, 도시 평균 아님"))
                .andExpect(
                        jsonPath("$.features[*].properties.evidence_id")
                                .value(
                                        contains(
                                                "ev_air_T001_202401",
                                                "ev_air_T002_202401",
                                                "ev_air_T004_202401",
                                                "ev_air_T001_202402",
                                                "ev_air_T003_202402",
                                                "ev_air_T004_202402")))
                .andExpect(
                        jsonPath("$.features[0].geometry.coordinates")
                                .value(contains(127.725967, 34.741301)))
                .andExpect(jsonPath("$.features[0].properties.value").value(17.5))
                .andExpect(jsonPath("$.features[0].properties.missing_reason").value(nullValue()))
                .andExpect(jsonPath("$.features[0].properties.period_start").value("2024-01-01"))
                .andExpect(jsonPath("$.features[0].properties.unit").value("µg/m³"))
                // 월 표에 있지만 월평균이 없는 달 / 월 표에 아예 없는 달
                .andExpect(jsonPath("$.features[3].properties.value").value(nullValue()))
                .andExpect(
                        jsonPath("$.features[3].properties.missing_reason").value("not_published"))
                .andExpect(
                        jsonPath("$.features[2].properties.missing_reason").value("not_collected"))
                .andExpect(jsonPath("$.features[4].properties.place_id").value("obs_stn_b"))
                .andExpect(jsonPath("$.features[4].properties.value").value(9.0))
                .andExpect(jsonPath("$.summary.station_count").value(3))
                .andExpect(jsonPath("$.summary.max_month.month").value("2024-01"))
                .andExpect(jsonPath("$.summary.max_month.place_id").value("obs_stn_b"))
                .andExpect(jsonPath("$.summary.min_month.month").value("2024-02"))
                .andExpect(jsonPath("$.summary.min_month.value").value(9.0))
                .andExpect(jsonPath("$.summary.bad_days_total").value(nullValue()));
    }

    @Test
    @WithMockUser
    void 좌표_없는_카드_C1_은_빈_점() throws Exception {
        mvc.perform(observations("obs_city", "C1", "2023-01-01", "2026-01-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(nullValue()))
                .andExpect(jsonPath("$.features").isEmpty());
    }

    @Test
    @WithMockUser
    void 잘못된_요청() throws Exception {
        mvc.perform(observations("obs_none", "A3", "2024-01-01", "2024-02-01"))
                .andExpect(status().isNotFound());
        mvc.perform(observations("obs_stn_a", "A3", "2024-01-01", "2024-02-01"))
                .andExpect(status().isNotFound());
        mvc.perform(observations("obs_city", "Z9", "2024-01-01", "2024-02-01"))
                .andExpect(status().isNotFound());
        mvc.perform(observations("obs_city", "A3", "2024-02-01", "2024-02-01"))
                .andExpect(status().isBadRequest());
        mvc.perform(observations("obs_city", "A3", "2024-01-15", "2024-02-01"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v1/observations").param("place_id", "obs_city"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 로그인_없이는_401() throws Exception {
        mvc.perform(observations("obs_city", "A3", "2024-01-01", "2024-02-01"))
                .andExpect(status().isUnauthorized());
    }

    private static MockHttpServletRequestBuilder observations(
            String placeId, String cardId, String start, String end) {
        return get("/v1/observations")
                .param("place_id", placeId)
                .param("card_id", cardId)
                .param("period_start", start)
                .param("period_end", end);
    }

    private void station(String id, String name, String parent, double lon, double lat) {
        jdbc.update(
                "INSERT INTO place(place_id,name,level,parent_id,geometry,location_precision,geometry_role)"
                        + " VALUES (?,?,'station',?,ST_SetSRID(ST_Point(?,?),4326)::geography,'exact','station')",
                id,
                name,
                parent,
                lon,
                lat);
    }

    private void code(String placeId, String code, String from, String to) {
        jdbc.update(
                "INSERT INTO place_code_map(place_id,code_system,place_code,valid_from,valid_to)"
                        + " VALUES (?,'airkorea_station',?,CAST(? AS date),CAST(? AS date))",
                placeId,
                code,
                from,
                to);
    }

    private void month(String code, String start, Double mean) {
        jdbc.update(
                "INSERT INTO air_monthly(station_code,station_name,indicator_id,unit,month_start,month_end,"
                        + "month_hours,valid_hours,held_hours,value_mean,value_min,value_max,has_provisional)"
                        + " VALUES (?,?,'air_pm25','µg/m³',CAST(? AS date)::timestamp AT TIME ZONE 'Asia/Seoul',"
                        + "(CAST(? AS date) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Seoul',"
                        + "720,?,0,?,?,?,false)",
                code,
                code,
                start,
                start,
                mean == null ? 100 : 720,
                mean,
                mean,
                mean);
    }
}
