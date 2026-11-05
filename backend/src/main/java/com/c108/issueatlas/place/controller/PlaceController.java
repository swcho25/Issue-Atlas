package com.c108.issueatlas.place.controller;

import com.c108.issueatlas.place.dto.PlaceBoundaryResponse;
import com.c108.issueatlas.place.dto.PlaceListResponse;
import com.c108.issueatlas.place.service.PlaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "places")
@RestController
@RequestMapping("/v1/places")
public class PlaceController {
    private final PlaceService places;

    public PlaceController(PlaceService places) {
        this.places = places;
    }

    /** parent_id 가 없으면 시군구 6곳, 있으면 그 시군구의 행정동. */
    @Operation(operationId = "listPlaces", summary = "지역 목록 (광주 5구·여수, parent_id 를 주면 그 시군구의 행정동)")
    @GetMapping
    public PlaceListResponse list(
            @Parameter(description = "시군구 place_id (예 kr-12210). 없는 지역이면 404")
                    @RequestParam(name = "parent_id", required = false)
                    String parentId) {
        return new PlaceListResponse(
                parentId == null ? places.listRegions() : places.listEmds(parentId));
    }

    /** 경계 GeoJSON. 시군구를 주면 그 시군구 + 행정동, 행정동을 주면 그 하나. */
    @Operation(
            operationId = "getPlaceBoundaries",
            summary = "지역 경계 GeoJSON (시군구를 주면 그 시군구 + 행정동 경계 한 번에)")
    @GetMapping("/{place_id}/boundaries")
    public PlaceBoundaryResponse boundaries(@PathVariable("place_id") String placeId) {
        return places.boundaries(placeId);
    }
}
