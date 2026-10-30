package com.c108.issueatlas.observation.controller;

import com.c108.issueatlas.observation.dto.ObservationsResponse;
import com.c108.issueatlas.observation.service.ObservationService;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/observations")
public class ObservationController {
    private final ObservationService observations;

    public ObservationController(ObservationService observations) {
        this.observations = observations;
    }

    /** 기간은 {@code [period_start, period_end)}. */
    @GetMapping
    public ObservationsResponse list(
            @RequestParam("place_id") String placeId,
            @RequestParam("card_id") String cardId,
            @RequestParam("period_start") LocalDate periodStart,
            @RequestParam("period_end") LocalDate periodEnd) {
        return observations.list(placeId, cardId, periodStart, periodEnd);
    }
}
