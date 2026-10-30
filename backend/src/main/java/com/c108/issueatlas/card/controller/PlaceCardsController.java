package com.c108.issueatlas.card.controller;

import com.c108.issueatlas.card.dto.PlaceCardsResponse;
import com.c108.issueatlas.card.service.CardService;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlaceCardsController {
    private final CardService cards;

    public PlaceCardsController(CardService cards) {
        this.cards = cards;
    }

    @GetMapping("/v1/places/{place_id}/cards")
    public PlaceCardsResponse list(
            @PathVariable("place_id") String placeId,
            @RequestParam("period_start") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate start,
            @RequestParam("period_end") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate end) {
        return cards.list(placeId, start, end);
    }
}
