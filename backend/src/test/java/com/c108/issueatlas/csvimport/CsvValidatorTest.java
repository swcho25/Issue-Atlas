package com.c108.issueatlas.csvimport;

import static org.assertj.core.api.Assertions.*;

import com.c108.issueatlas.csvimport.repository.CsvImportRepository.Catalog;
import com.c108.issueatlas.csvimport.service.CsvValidator;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;

class CsvValidatorTest {
    Catalog catalog =
            new Catalog(Set.of("s"), Map.of("sp", "s"), Set.of("kr-1"), Set.of("C1"), Set.of("i"));
    String header = String.join(",", CsvValidator.COLUMNS) + "\r\n";
    String row =
            "document,s,sp,key,kr-1,C1,2024-01-01T00:00:00Z,2025-01-01T00:00:00Z,,,,,\"제목, 인용\",\"두 줄\n요약\",https://example.org";

    @Test
    void quotedCommasMultilineAndBomAreAccepted() {
        var parsed = CsvValidator.parse(("\uFEFF" + header + row).getBytes(StandardCharsets.UTF_8));
        var result = CsvValidator.validate(parsed, catalog, Set.of());
        assertThat(result.errorCount()).isZero();
        assertThat(result.totalRows()).isEqualTo(1);
    }

    @Test
    void invalidEncodingHeadersQuotesEmptyFileAndRowLimitAreRejected() {
        for (byte[] bytes :
                List.of(
                        new byte[] {(byte) 0xff},
                        "wrong,header".getBytes(StandardCharsets.UTF_8),
                        (header + "\"unterminated").getBytes(StandardCharsets.UTF_8),
                        header.getBytes(StandardCharsets.UTF_8),
                        (header + (row + "\n").repeat(2001)).getBytes(StandardCharsets.UTF_8))) {
            assertThat(CsvValidator.parse(bytes).errors()).isNotEmpty();
        }
    }

    @Test
    void invalidReferencesDatesNumbersFormulasAndColumnsAreReported() {
        for (String bad :
                List.of(
                        row.replace("kr-1", "missing"),
                        row.replace("2025-01-01", "2023-01-01"),
                        row.replace("제목, 인용", "=FORMULA()"),
                        row.replace("https://example.org", "relative/path"),
                        row.replace("두 줄\n요약", "=FORMULA()\n두 줄"),
                        row + ",extra",
                        "indicator,s,sp,key,kr-1,C1,2024-01-01T00:00:00Z,2025-01-01T00:00:00Z,i,NaN,명,,,,")) {
            var result =
                    CsvValidator.validate(
                            CsvValidator.parse((header + bad).getBytes(StandardCharsets.UTF_8)),
                            catalog,
                            Set.of());
            assertThat(result.errorCount()).isPositive();
        }
    }

    @Test
    void errorsAreBoundedWithoutLosingTotalCount() {
        var result =
                CsvValidator.validate(
                        CsvValidator.parse(
                                (header + (row.replace("kr-1", "missing") + "\n").repeat(101))
                                        .getBytes(StandardCharsets.UTF_8)),
                        catalog,
                        Set.of());
        assertThat(result.errors()).hasSize(100);
        assertThat(result.errorCount()).isEqualTo(101);
        assertThat(result.errorsTruncated()).isTrue();
    }
}
