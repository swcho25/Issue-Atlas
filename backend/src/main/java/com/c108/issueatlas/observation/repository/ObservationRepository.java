package com.c108.issueatlas.observation.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 측정소(place level station) × 월. 월평균은 P2 가 채운 air_monthly 를 그대로 읽고 다시 계산하지 않는다. */
@Repository
public class ObservationRepository {
    // 측정소는 지역의 자식(parent_id). 코드는 place_code_map(airkorea_station)의 유효 기간 안에서만 잇는다.
    // 좌표 없는 측정소는 지도에 찍지 않는다. 월 값이 없으면 collected = false
    private static final String STATION_MONTHS =
            """
            SELECT s.place_id, s.name, c.place_code AS station_code,
                   ST_X(s.geometry::geometry) AS lon, ST_Y(s.geometry::geometry) AS lat,
                   s.location_precision, mon::date AS month,
                   m.station_code IS NOT NULL AS collected, m.value_mean, m.unit
            FROM place s
            JOIN place_code_map c ON c.place_id = s.place_id AND c.code_system = 'airkorea_station'
            CROSS JOIN generate_series(CAST(:start AS date), CAST(:end AS date) - 1, interval '1 month') AS mon
            LEFT JOIN air_monthly m ON m.station_code = c.place_code AND m.indicator_id = :indicator
                AND m.month_start = mon::date::timestamp AT TIME ZONE 'Asia/Seoul'
            WHERE s.level = 'station' AND s.parent_id = :placeId AND s.geometry IS NOT NULL
              AND (c.valid_from IS NULL OR c.valid_from <= mon::date)
              AND (c.valid_to IS NULL OR c.valid_to >= mon::date)
            ORDER BY mon, c.place_code
            """;

    private final JdbcClient jdbc;

    public ObservationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean regionExists(String placeId) {
        return jdbc.sql(
                        "SELECT EXISTS (SELECT 1 FROM place WHERE place_id = ? AND level <> 'station')")
                .param(placeId)
                .query(Boolean.class)
                .single();
    }

    /** {@code [start, end)} 의 달마다 측정소 한 줄. start · end 는 달의 1일. */
    public List<StationMonthRow> findStationMonths(
            String placeId, String indicatorId, LocalDate start, LocalDate end) {
        return jdbc.sql(STATION_MONTHS)
                .param("placeId", placeId)
                .param("indicator", indicatorId)
                .param("start", start)
                .param("end", end)
                .query(StationMonthRow.class)
                .list();
    }

    public record StationMonthRow(
            String placeId,
            String name,
            String stationCode,
            double lon,
            double lat,
            String locationPrecision,
            LocalDate month,
            boolean collected,
            BigDecimal valueMean,
            String unit) {}
}
