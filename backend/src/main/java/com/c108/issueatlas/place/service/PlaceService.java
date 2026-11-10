package com.c108.issueatlas.place.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.place.dto.PlaceBoundaryResponse;
import com.c108.issueatlas.place.dto.PlaceBoundaryResponse.Feature;
import com.c108.issueatlas.place.dto.PlaceBoundaryResponse.Properties;
import com.c108.issueatlas.place.dto.PlaceListResponse.CodeResponse;
import com.c108.issueatlas.place.dto.PlaceListResponse.PlaceResponse;
import com.c108.issueatlas.place.repository.PlaceRepository;
import com.c108.issueatlas.place.repository.PlaceRepository.RegionCodeRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PlaceService {
    private final PlaceRepository places;

    public PlaceService(PlaceRepository places) {
        this.places = places;
    }

    public List<PlaceResponse> listRegions() {
        return group(places.findRegionCodes());
    }

    /** 시군구 아래 행정동. 없는 지역이면 404, 행정동이 없는 지역(측정소 · 시도 등)이면 빈 목록. */
    public List<PlaceResponse> listEmds(String parentId) {
        if (!places.exists(parentId)) {
            throw new ResourceNotFoundException();
        }
        return group(places.findEmdCodes(parentId));
    }

    /** 경계 GeoJSON. 없는 지역이면 404, 경계가 없는 지역(측정소 · 시도)이면 빈 목록. */
    public PlaceBoundaryResponse boundaries(String placeId) {
        if (!places.exists(placeId)) {
            throw new ResourceNotFoundException();
        }
        return new PlaceBoundaryResponse(
                places.findBoundaries(placeId).stream()
                        .map(
                                row ->
                                        new Feature(
                                                row.placeId(),
                                                row.geometry(),
                                                new Properties(
                                                        row.placeId(),
                                                        row.name(),
                                                        row.level(),
                                                        row.parentId(),
                                                        row.source(),
                                                        row.sourceYear())))
                        .toList());
    }

    private static List<PlaceResponse> group(List<RegionCodeRow> rows) {
        return rows.stream()
                .collect(
                        Collectors.groupingBy(
                                RegionCodeRow::placeId, LinkedHashMap::new, Collectors.toList()))
                .values()
                .stream()
                .map(PlaceService::toResponse)
                .toList();
    }

    private static PlaceResponse toResponse(List<RegionCodeRow> rows) {
        RegionCodeRow place = rows.getFirst();
        List<CodeResponse> codes =
                rows.stream()
                        .filter(row -> row.codeSystem() != null)
                        .map(
                                row ->
                                        new CodeResponse(
                                                row.codeSystem(),
                                                row.placeCode(),
                                                row.validFrom(),
                                                row.validTo()))
                        .toList();
        return new PlaceResponse(
                place.placeId(), place.name(), place.level(), place.parentId(), codes);
    }
}
