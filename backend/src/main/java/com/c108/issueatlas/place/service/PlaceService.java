package com.c108.issueatlas.place.service;

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
        return places.findRegionCodes().stream()
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
