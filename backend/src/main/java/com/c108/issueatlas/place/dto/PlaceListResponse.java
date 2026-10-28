package com.c108.issueatlas.place.dto;

import java.time.LocalDate;
import java.util.List;

/** C2 {@code place-list.schema.json}. */
public record PlaceListResponse(String schemaVersion, List<PlaceResponse> places) {
    public static final String SCHEMA_VERSION = "c2-0.1";

    public PlaceListResponse(List<PlaceResponse> places) {
        this(SCHEMA_VERSION, places);
    }

    public record PlaceResponse(
            String placeId, String name, String level, String parentId, List<CodeResponse> codes) {}

    /** valid_from · valid_to 는 날짜 단위, 양 끝 포함. null 은 경계 미상 · 무제한. */
    public record CodeResponse(
            String codeSystem, String placeCode, LocalDate validFrom, LocalDate validTo) {}
}
