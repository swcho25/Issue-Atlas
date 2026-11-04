package com.c108.issueatlas.csvimport.service;

import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import com.c108.issueatlas.csvimport.repository.CsvImportRepository.Catalog;
import java.io.*;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;

/** 파일을 검사할 뿐, 업무 테이블로 변환하거나 적재하지 않는다. */
public final class CsvValidator {
    public static final int MAX_BYTES = 2097152;
    public static final int MAX_ROWS = 2000;
    public static final List<String> COLUMNS =
            List.of(
                    "data_kind",
                    "source_id",
                    "spec_id",
                    "dedup_key",
                    "place_id",
                    "card_ids",
                    "period_start",
                    "period_end",
                    "indicator_id",
                    "value",
                    "unit",
                    "missing_reason",
                    "title",
                    "summary",
                    "url");

    private CsvValidator() {}

    public record Parsed(List<CSVRecord> rows, List<Problem> errors) {}

    public static Parsed parse(byte[] bytes) {
        try {
            String text =
                    StandardCharsets.UTF_8
                            .newDecoder()
                            .onMalformedInput(CodingErrorAction.REPORT)
                            .onUnmappableCharacter(CodingErrorAction.REPORT)
                            .decode(ByteBuffer.wrap(bytes))
                            .toString();
            if (text.startsWith("\uFEFF")) text = text.substring(1);
            try (var parser = CSVFormat.RFC4180.parse(new StringReader(text))) {
                var it = parser.iterator();
                if (!it.hasNext() || !it.next().toList().equals(COLUMNS))
                    return failed("header_mismatch");
                List<CSVRecord> rows = new ArrayList<>();
                while (it.hasNext()) {
                    if (rows.size() == MAX_ROWS) return failed("too_many_rows");
                    rows.add(it.next());
                }
                return rows.isEmpty() ? failed("empty_data") : new Parsed(rows, List.of());
            }
        } catch (CharacterCodingException ex) {
            return failed("invalid_utf8");
        } catch (IOException | UncheckedIOException | IllegalArgumentException ex) {
            return failed("malformed_csv");
        }
    }

    private static Parsed failed(String code) {
        return new Parsed(List.of(), List.of(new Problem(1, "file", code)));
    }

    public static Set<String> keys(Parsed parsed) {
        Set<String> keys = new HashSet<>();
        for (var row : parsed.rows())
            if (row.size() == COLUMNS.size() && row.get(3).length() <= 512) keys.add(row.get(3));
        return keys;
    }

    public static Validation validate(Parsed parsed, Catalog catalog, Set<String> existing) {
        if (!parsed.errors().isEmpty())
            return new Validation(
                    0, 0, 0, 0, parsed.errors().size(), false, parsed.errors(), List.of());
        List<Problem> errors = new ArrayList<>();
        List<Long> duplicates = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int valid = 0;
        int errorCount = 0;
        for (var row : parsed.rows()) {
            List<Problem> rowErrors = new ArrayList<>();
            long number = row.getRecordNumber();
            if (row.size() != COLUMNS.size())
                rowErrors.add(new Problem(number, "row", "column_count"));
            else {
                for (int i = 0; i < COLUMNS.size(); i++) {
                    String value = row.get(i);
                    if (value.length() > 4000
                            || value.chars()
                                    .anyMatch(c -> c == 0 || (c < 32 && c != '\n' && c != '\r')))
                        rowErrors.add(new Problem(number, COLUMNS.get(i), "invalid_text"));
                    String leading = value.stripLeading();
                    if (i != 9 && !leading.isEmpty() && "=+-@".indexOf(leading.charAt(0)) >= 0)
                        rowErrors.add(new Problem(number, COLUMNS.get(i), "spreadsheet_formula"));
                }
                for (int i = 0; i < 8; i++)
                    if (row.get(i).isBlank())
                        rowErrors.add(new Problem(number, COLUMNS.get(i), "required"));
                String kind = row.get(0);
                if (!Set.of("indicator", "document").contains(kind))
                    rowErrors.add(new Problem(number, "data_kind", "invalid_kind"));
                if (!catalog.sources().contains(row.get(1)))
                    rowErrors.add(new Problem(number, "source_id", "unknown_reference"));
                if (!row.get(1).equals(catalog.specs().get(row.get(2))))
                    rowErrors.add(new Problem(number, "spec_id", "source_mismatch"));
                if (row.get(3).length() > 512)
                    rowErrors.add(new Problem(number, "dedup_key", "too_long"));
                if (!catalog.places().contains(row.get(4)))
                    rowErrors.add(new Problem(number, "place_id", "unknown_reference"));
                var cards = Arrays.asList(row.get(5).split(";", -1));
                if (new HashSet<>(cards).size() != cards.size()
                        || !catalog.cards().containsAll(cards))
                    rowErrors.add(new Problem(number, "card_ids", "unknown_or_repeated_reference"));
                try {
                    var start = OffsetDateTime.parse(row.get(6));
                    var end = OffsetDateTime.parse(row.get(7));
                    if (!start.isBefore(end)) throw new IllegalArgumentException();
                } catch (RuntimeException ex) {
                    rowErrors.add(new Problem(number, "period_end", "invalid_period"));
                }
                if (kind.equals("indicator")) {
                    if (!catalog.indicators().contains(row.get(8)))
                        rowErrors.add(new Problem(number, "indicator_id", "unknown_reference"));
                    if (row.get(10).isBlank())
                        rowErrors.add(new Problem(number, "unit", "required"));
                    if (row.get(9).isBlank() == row.get(11).isBlank())
                        rowErrors.add(new Problem(number, "value", "value_or_missing_reason"));
                    if (!row.get(11).isBlank()
                            && !Set.of("not_published", "not_collected", "license_blocked")
                                    .contains(row.get(11)))
                        rowErrors.add(
                                new Problem(number, "missing_reason", "invalid_missing_reason"));
                    if (!row.get(9).isBlank())
                        try {
                            var value = new BigDecimal(row.get(9));
                            if (value.precision() > 38 || Math.abs((long) value.scale()) > 18)
                                throw new NumberFormatException();
                        } catch (NumberFormatException ex) {
                            rowErrors.add(new Problem(number, "value", "invalid_number"));
                        }
                }
                if (kind.equals("document")) {
                    if (row.get(12).isBlank())
                        rowErrors.add(new Problem(number, "title", "required"));
                    for (int i = 8; i <= 11; i++)
                        if (!row.get(i).isEmpty())
                            rowErrors.add(
                                    new Problem(
                                            number,
                                            COLUMNS.get(i),
                                            "document_field_must_be_empty"));
                }
                if (!row.get(14).isEmpty())
                    try {
                        var uri = URI.create(row.get(14));
                        if (!("http".equalsIgnoreCase(uri.getScheme())
                                        || "https".equalsIgnoreCase(uri.getScheme()))
                                || uri.getHost() == null
                                || uri.getUserInfo() != null) throw new IllegalArgumentException();
                    } catch (IllegalArgumentException ex) {
                        rowErrors.add(new Problem(number, "url", "invalid_url"));
                    }
                if (rowErrors.isEmpty()) {
                    valid++;
                    if (existing.contains(row.get(3)) || !seen.add(row.get(3)))
                        duplicates.add(number);
                }
            }
            errorCount += rowErrors.size();
            for (var error : rowErrors) if (errors.size() < 100) errors.add(error);
        }
        return new Validation(
                parsed.rows().size(),
                valid,
                duplicates.size(),
                valid - duplicates.size(),
                errorCount,
                errorCount > 100,
                errors,
                duplicates);
    }
}
