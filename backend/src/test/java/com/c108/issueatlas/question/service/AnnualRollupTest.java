package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.question.repository.QuestionRepository.ObservationRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AnnualRollupTest {
    private final ObjectMapper json = new ObjectMapper();

    private JsonNode definition(String method, int months) {
        return json.readTree(
                "{\"roll\":{\"method\":\"" + method + "\",\"min_months\":" + months + "}}");
    }

    private static List<ObservationRow> months(String station, int year, int count, int value) {
        List<ObservationRow> rows = new ArrayList<>();
        for (int month = 1; month <= count; month++) {
            rows.add(
                    new ObservationRow(
                            station,
                            "M",
                            "%d-%02d".formatted(year, month),
                            BigDecimal.valueOf(value),
                            "available"));
        }
        return rows;
    }

    @Test
    void sumNeedsTwelveAvailableMonthsAndWholeYear() {
        List<ObservationRow> rows = new ArrayList<>(months(null, 2023, 12, -10));
        rows.addAll(months(null, 2024, 11, -10));
        rows.add(new ObservationRow(null, "M", "2024-12", null, "not_published"));
        assertThat(
                        AnnualRollup.apply(
                                        rows,
                                        definition("sum", 12),
                                        LocalDate.of(2023, 1, 1),
                                        LocalDate.of(2025, 1, 1))
                                .bySeries()
                                .get("_place"))
                .containsOnlyKeys(2023)
                .containsEntry(2023, new BigDecimal("-120"));
        assertThat(
                        AnnualRollup.apply(
                                        rows,
                                        definition("sum", 12),
                                        LocalDate.of(2023, 2, 1),
                                        LocalDate.of(2025, 1, 1))
                                .bySeries())
                .isEmpty();
    }

    @Test
    void meanUsesNineValidMonthsPerStation() {
        List<ObservationRow> rows = new ArrayList<>(months("one", 2023, 9, 12));
        rows.addAll(months("two", 2023, 8, 100));
        Map<String, SortedMap<Integer, BigDecimal>> result =
                AnnualRollup.apply(
                                rows,
                                definition("mean", 9),
                                LocalDate.of(2023, 1, 1),
                                LocalDate.of(2024, 1, 1))
                        .bySeries();
        assertThat(result).containsOnlyKeys("one");
        assertThat(result.get("one")).containsEntry(2023, new BigDecimal("12"));
    }
}
