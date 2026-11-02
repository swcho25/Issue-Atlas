package com.c108.issueatlas.place.controller;

import com.c108.issueatlas.place.dto.PlaceListResponse;
import com.c108.issueatlas.place.service.PlaceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/places")
public class PlaceController {
    private final PlaceService places;

    public PlaceController(PlaceService places) {
        this.places = places;
    }

    /** parent_id 가 없으면 시군구 6곳, 있으면 그 시군구의 행정동. */
    @GetMapping
    public PlaceListResponse list(
            @RequestParam(name = "parent_id", required = false) String parentId) {
        return new PlaceListResponse(
                parentId == null ? places.listRegions() : places.listEmds(parentId));
    }
}
