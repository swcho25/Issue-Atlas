package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.PlaceCardsResponse;
import com.c108.issueatlas.card.service.CardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "places")
@RestController
public class PlaceCardsController {
    private final CardService cards;

    public PlaceCardsController(CardService cards) {
        this.cards = cards;
    }

    @Operation(operationId = "listPlaceCards", summary = "지역의 이슈 카드 목록과 근거 확보 상태 (점수·순위 없음)")
    @GetMapping("/v1/places/{place_id}/cards")
    public PlaceCardsResponse list(
            @Parameter(description = "시군구 place_id (예 kr-12130)") @PathVariable("place_id")
                    String placeId,
            @Parameter(description = "기간 시작(포함), YYYY-MM-DD")
                    @RequestParam("period_start")
                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate start,
            @Parameter(description = "기간 끝(미포함), YYYY-MM-DD")
                    @RequestParam("period_end")
                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate end) {
        return cards.list(placeId, start, end);
    }
}
