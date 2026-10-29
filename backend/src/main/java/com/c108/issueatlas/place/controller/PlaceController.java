package com.c108.issueatlas.place.controller;

import com.c108.issueatlas.place.dto.PlaceListResponse;
import com.c108.issueatlas.place.service.PlaceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/places")
public class PlaceController {
    private final PlaceService places;

    public PlaceController(PlaceService places) {
        this.places = places;
    }

    @GetMapping
    public PlaceListResponse list() {
        return new PlaceListResponse(places.listRegions());
    }
}
