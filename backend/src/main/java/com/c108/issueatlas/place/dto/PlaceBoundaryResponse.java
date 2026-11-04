package com.c108.issueatlas.place.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;
import java.util.List;

/** C2 {@code place-boundaries.schema.json}. GeoJSON FeatureCollection 에 schema_version 을 더한 모양. */
public record PlaceBoundaryResponse(String schemaVersion, String type, List<Feature> features) {
    public static final String SCHEMA_VERSION = "c2-0.1";

    public PlaceBoundaryResponse(List<Feature> features) {
        this(SCHEMA_VERSION, "FeatureCollection", features);
    }

    public record Feature(
            String type,
            String id,
            // PostGIS ST_AsGeoJSON 결과(MultiPolygon)를 그대로 객체로 내보낸다
            @JsonRawValue String geometry,
            Properties properties) {
        public Feature(String id, String geometry, Properties properties) {
            this("Feature", id, geometry, properties);
        }
    }

    public record Properties(
            String placeId,
            String name,
            String level,
            String parentId,
            String source,
            int sourceYear) {}
}
