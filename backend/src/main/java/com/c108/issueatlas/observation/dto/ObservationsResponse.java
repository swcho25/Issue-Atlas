package com.c108.issueatlas.observation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** C2 {@code observations.schema.json}. GeoJSON FeatureCollection. */
public record ObservationsResponse(
        String schemaVersion,
        String type,
        String placeId,
        String cardId,
        LocalDate periodStart,
        LocalDate periodEnd,
        String legendText,
        Summary summary,
        List<Feature> features) {
    public static final String SCHEMA_VERSION = "c2-0.1";

    public ObservationsResponse(
            String placeId,
            String cardId,
            LocalDate periodStart,
            LocalDate periodEnd,
            String legendText,
            Summary summary,
            List<Feature> features) {
        this(
                SCHEMA_VERSION,
                "FeatureCollection",
                placeId,
                cardId,
                periodStart,
                periodEnd,
                legendText,
                summary,
                features);
    }

    /** 좌표 없는 카드(C1)는 null. 나쁨 일수는 일 단위 자료가 없으면 null. */
    public record Summary(
            int stationCount, MonthPoint maxMonth, MonthPoint minMonth, Integer badDaysTotal) {}

    public record MonthPoint(String month, String placeId, String name, BigDecimal value) {}

    public record Feature(String type, Point geometry, Properties properties) {
        public Feature(Point geometry, Properties properties) {
            this("Feature", geometry, properties);
        }
    }

    /** 좌표는 GeoJSON 순서 [경도, 위도]. */
    public record Point(String type, List<Double> coordinates) {
        public Point(double lon, double lat) {
            this("Point", List.of(lon, lat));
        }
    }

    /** value 가 null 이면 missing_reason 이 있고, 값이 있으면 missing_reason 은 null. */
    public record Properties(
            String evidenceId,
            String placeId,
            String name,
            String stationType,
            OffsetDateTime observedAt,
            String periodType,
            LocalDate periodStart,
            BigDecimal value,
            String unit,
            String missingReason,
            String locationPrecision,
            String geometryRole) {}
}
