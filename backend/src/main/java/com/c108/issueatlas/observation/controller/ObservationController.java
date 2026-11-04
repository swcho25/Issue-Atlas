package com.c108.issueatlas.observation.controller;

import com.c108.issueatlas.observation.dto.ObservationsResponse;
import com.c108.issueatlas.observation.service.ObservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "evidence")
@RestController
@RequestMapping("/v1/observations")
public class ObservationController {
    private final ObservationService observations;

    public ObservationController(ObservationService observations) {
        this.observations = observations;
    }

    /** 기간은 {@code [period_start, period_end)}. */
    @Operation(
            operationId = "listObservations",
            summary = "지도 점 (GeoJSON). 좌표 없는 통계 카드는 features 빈 배열")
    @GetMapping
    public ObservationsResponse list(
            @Parameter(description = "시군구 place_id (예 kr-12130)") @RequestParam("place_id")
                    String placeId,
            @Parameter(description = "카드 ID (예 A3)") @RequestParam("card_id") String cardId,
            @Parameter(description = "기간 시작(포함), 달의 1일 YYYY-MM-01") @RequestParam("period_start")
                    LocalDate periodStart,
            @Parameter(description = "기간 끝(미포함), 달의 1일 YYYY-MM-01") @RequestParam("period_end")
                    LocalDate periodEnd) {
        return observations.list(placeId, cardId, periodStart, periodEnd);
    }
}
