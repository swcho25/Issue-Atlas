package com.c108.issueatlas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/** V0016 기사 사건 표(contracts/p3)의 CHECK 를 실제 PostGIS 에서 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class NewsEventMigrationTest {
    private static final String SIDO = "전남광주통합특별시";

    private final JdbcTemplate jdbc;

    NewsEventMigrationTest(@Autowired JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM news_event");
    }

    @Test
    void 좌표가_있는_기사와_없는_기사를_저장한다() {
        // P3 지역표의 실제 행: 광양항(주소 좌표, 발행 시각) · 광주 특별 단속(좌표 없음, 날짜 기간)
        insert(
                "01620001.20230118163810001",
                "2023-01-18T00:00:00+09:00",
                null,
                "published",
                127.6589046,
                34.9017720,
                "address",
                SIDO);
        insert(
                "02100501.20230109090723001",
                "2023-01-09T00:00:00+09:00",
                "2023-05-01T00:00:00+09:00",
                "day",
                null,
                null,
                "none",
                SIDO);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM news_event", Integer.class))
                .isEqualTo(2);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT ST_X(geometry::geometry) FROM news_event WHERE news_id = '01620001.20230118163810001'",
                                Double.class))
                .isEqualTo(127.6589046);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT event_start = TIMESTAMPTZ '2023-01-08 15:00:00Z' FROM news_event WHERE news_id = '02100501.20230109090723001'",
                                Boolean.class))
                .isTrue();
    }

    @Test
    void 끝이_시작보다_늦지_않으면_거절한다() {
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-period",
                                        "2023-01-09T00:00:00+09:00",
                                        "2023-01-09T00:00:00+09:00",
                                        "day",
                                        null,
                                        null,
                                        "none",
                                        SIDO))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 좌표_없이_위치_정밀도를_적으면_거절한다() {
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-precision",
                                        "2023-01-09T00:00:00+09:00",
                                        null,
                                        "published",
                                        null,
                                        null,
                                        "address",
                                        SIDO))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 한국_범위_밖_좌표는_거절한다() {
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-coordinates",
                                        "2023-01-09T00:00:00+09:00",
                                        null,
                                        "published",
                                        140.0,
                                        34.9,
                                        "address",
                                        SIDO))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 정해진_값_밖이거나_시도가_없으면_거절한다() {
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-time",
                                        "2023-01-09T00:00:00+09:00",
                                        null,
                                        "week",
                                        null,
                                        null,
                                        "none",
                                        SIDO))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-location",
                                        "2023-01-09T00:00:00+09:00",
                                        null,
                                        "published",
                                        127.6589046,
                                        34.9017720,
                                        "exact",
                                        SIDO))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                insert(
                                        "bad-sido",
                                        "2023-01-09T00:00:00+09:00",
                                        null,
                                        "published",
                                        null,
                                        null,
                                        "none",
                                        null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void insert(
            String newsId,
            String start,
            String end,
            String timePrecision,
            Double lon,
            Double lat,
            String locationPrecision,
            String sido) {
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,event_end,time_precision,geometry,location_precision,sido)"
                        + " VALUES (?,CAST(? AS timestamptz),CAST(? AS timestamptz),?,"
                        + "ST_SetSRID(ST_MakePoint(CAST(? AS double precision),CAST(? AS double precision)),4326)::geography,?,?)",
                newsId,
                start,
                end,
                timePrecision,
                lon,
                lat,
                locationPrecision,
                sido);
    }
}
