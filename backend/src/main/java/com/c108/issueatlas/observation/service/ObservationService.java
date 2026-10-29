package com.c108.issueatlas.observation.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.observation.dto.ObservationsResponse;
import com.c108.issueatlas.observation.dto.ObservationsResponse.Feature;
import com.c108.issueatlas.observation.dto.ObservationsResponse.MonthPoint;
import com.c108.issueatlas.observation.dto.ObservationsResponse.Point;
import com.c108.issueatlas.observation.dto.ObservationsResponse.Properties;
import com.c108.issueatlas.observation.dto.ObservationsResponse.Summary;
import com.c108.issueatlas.observation.repository.ObservationRepository;
import com.c108.issueatlas.observation.repository.ObservationRepository.StationMonthRow;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ObservationService {
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter EVIDENCE_MONTH = DateTimeFormatter.ofPattern("yyyyMM");

    /**
     * 지도 점을 그리는 카드. 지표와 범례 문구는 카드 양식 v1.1 의 B2 · E2.
     *
     * <p>ponytail: 카드 표가 없어 상수로 둔다. 카드 목록 API(S15P31C108-132)에서 카드 표가 생기면 거기서 읽는다
     */
    private enum MapCard {
        A3("air_pm25", "측정소 값, 도시 평균 아님"),
        C1(null, "집계 이동량 (전연령, 이동 경로 아님)");

        private final String indicatorId;
        private final String legendText;

        MapCard(String indicatorId, String legendText) {
            this.indicatorId = indicatorId;
            this.legendText = legendText;
        }
    }

    private final ObservationRepository observations;

    public ObservationService(ObservationRepository observations) {
        this.observations = observations;
    }

    public ObservationsResponse list(
            String placeId, String cardId, LocalDate start, LocalDate end) {
        MapCard card = findCard(cardId).orElseThrow(ResourceNotFoundException::new);
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        if (!observations.regionExists(placeId)) {
            throw new ResourceNotFoundException();
        }
        if (card.indicatorId == null) {
            // 좌표가 없는 통계 카드는 지도에 찍지 않는다 (FR-D7)
            return new ObservationsResponse(
                    placeId, cardId, start, end, card.legendText, null, List.of());
        }
        // ponytail: 달 중간에서 시작 · 끝나는 기간을 어느 달에 넣을지 계약에 없다. 정해지기 전에는 받지 않는다
        if (start.getDayOfMonth() != 1 || end.getDayOfMonth() != 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        List<StationMonthRow> rows =
                observations.findStationMonths(placeId, card.indicatorId, start, end);
        return new ObservationsResponse(
                placeId,
                cardId,
                start,
                end,
                card.legendText,
                summary(rows),
                rows.stream().map(ObservationService::feature).toList());
    }

    private static Optional<MapCard> findCard(String cardId) {
        for (MapCard card : MapCard.values()) {
            if (card.name().equals(cardId)) {
                return Optional.of(card);
            }
        }
        return Optional.empty();
    }

    private static Feature feature(StationMonthRow row) {
        // ponytail: 근거 ID 표가 없어 C2 예시와 같은 규칙으로 만든다. 근거 상세 API(S15P31C108-134)의 ID 로 바꾼다
        String evidenceId =
                "ev_air_" + row.stationCode() + "_" + row.month().format(EVIDENCE_MONTH);
        String missingReason = null;
        if (!row.collected()) {
            missingReason = "not_collected";
        } else if (row.valueMean() == null) {
            // 월 표에는 있지만 유효 시간이 75% 미만이라 월평균을 내지 않은 달
            missingReason = "not_published";
        }
        return new Feature(
                new Point(row.lon(), row.lat()),
                new Properties(
                        evidenceId,
                        row.placeId(),
                        row.name(),
                        null,
                        null,
                        "M",
                        row.month(),
                        row.valueMean(),
                        row.unit(),
                        missingReason,
                        row.locationPrecision(),
                        "station"));
    }

    private static Summary summary(List<StationMonthRow> rows) {
        List<StationMonthRow> valued = rows.stream().filter(r -> r.valueMean() != null).toList();
        Comparator<StationMonthRow> byValue = Comparator.comparing(StationMonthRow::valueMean);
        return new Summary(
                (int) rows.stream().map(StationMonthRow::placeId).distinct().count(),
                valued.stream().max(byValue).map(ObservationService::monthPoint).orElse(null),
                valued.stream().min(byValue).map(ObservationService::monthPoint).orElse(null),
                null);
    }

    private static MonthPoint monthPoint(StationMonthRow row) {
        return new MonthPoint(
                row.month().format(MONTH), row.placeId(), row.name(), row.valueMean());
    }
}
