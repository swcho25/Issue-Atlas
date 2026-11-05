package com.c108.issueatlas.card.service;

import com.c108.issueatlas.card.dto.PlaceCardsResponse;
import com.c108.issueatlas.card.dto.PlaceCardsResponse.CardResponse;
import com.c108.issueatlas.card.dto.PlaceCardsResponse.EvidenceResponse;
import com.c108.issueatlas.card.repository.CardRepository;
import com.c108.issueatlas.card.repository.CardRepository.CardEvidenceRow;
import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import java.text.Collator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;

@Service
public class CardService {
    private final CardRepository cards;

    public CardService(CardRepository cards) {
        this.cards = cards;
    }

    @Transactional(readOnly = true)
    public PlaceCardsResponse list(String placeId, LocalDate start, LocalDate end) {
        if (!start.isBefore(end)) {
            throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
        }
        if (!cards.placeExists(placeId)) {
            throw new ResourceNotFoundException();
        }
        List<CardEvidenceRow> rows = cards.findCardsForList(placeId, start, end);
        Map<String, List<CardEvidenceRow>> grouped = new LinkedHashMap<>();
        for (CardEvidenceRow row : rows) {
            grouped.computeIfAbsent(row.cardId(), ignored -> new ArrayList<>()).add(row);
        }
        Collator korean = Collator.getInstance(Locale.KOREAN);
        List<CardResponse> result =
                grouped.values().stream()
                        .map(
                                group -> {
                                    CardEvidenceRow first = group.getFirst();
                                    return new CardResponse(
                                            first.cardId(),
                                            first.name(),
                                            first.domain(),
                                            first.parentQuestion(),
                                            first.cardVersion(),
                                            group.stream()
                                                    .map(
                                                            r ->
                                                                    new EvidenceResponse(
                                                                            r.kind(), r.status()))
                                                    .toList(),
                                            (int)
                                                    group.stream()
                                                            .filter(
                                                                    r ->
                                                                            r.status()
                                                                                    .equals(
                                                                                            "available"))
                                                            .count(),
                                            group.stream()
                                                    .mapToInt(CardEvidenceRow::reviewPendingCount)
                                                    .sum());
                                })
                        .sorted(
                                Comparator.comparing(CardResponse::domain, korean)
                                        .thenComparing(CardResponse::name, korean)
                                        .thenComparing(CardResponse::cardId))
                        .toList();
        // 하나의 목록에는 하나의 분류 버전만 사용한다. 혼합 버전은 조용히 잘못 표시하지 않는다.
        List<String> versions =
                rows.stream().map(CardEvidenceRow::taxonomyVersion).distinct().toList();
        if (versions.size() != 1) {
            throw new IllegalStateException("Card catalog must have one taxonomy version");
        }
        return new PlaceCardsResponse("c2-0.1", placeId, start, end, versions.getFirst(), result);
    }
}
