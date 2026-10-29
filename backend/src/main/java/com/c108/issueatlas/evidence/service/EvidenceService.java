package com.c108.issueatlas.evidence.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.evidence.dto.EvidenceResponse;
import com.c108.issueatlas.evidence.repository.EvidenceRepository;
import com.c108.issueatlas.evidence.repository.EvidenceRepository.EvidenceRow;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EvidenceService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private final EvidenceRepository evidence;

    public EvidenceService(EvidenceRepository evidence) {
        this.evidence = evidence;
    }

    public EvidenceResponse get(String evidenceId) {
        EvidenceRow row = evidence.find(evidenceId).orElseThrow(ResourceNotFoundException::new);
        return new EvidenceResponse(
                EvidenceResponse.SCHEMA_VERSION,
                row.evidenceId(),
                row.kind(),
                row.title(),
                row.sourceName(),
                row.sourceGrade(),
                row.licenseType(),
                row.storageScope(),
                row.observedAt(),
                row.periodStart(),
                row.periodEnd(),
                row.publishedAt(),
                row.collectedAt(),
                row.locationPrecision(),
                row.locator(),
                row.display(),
                row.url(),
                footnote(row));
    }

    /** FR-E4: 출처명 · 자료명 · 시점 · 출처 등급 · URL · 조회일. 시점 · URL 이 없으면 그 칸을 뺀다. */
    static String footnote(EvidenceRow row) {
        List<String> parts = new ArrayList<>(List.of(row.sourceName(), row.title()));
        String when = when(row);
        if (when != null) {
            parts.add(when);
        }
        parts.add("출처 등급 " + row.sourceGrade());
        if (row.url() != null) {
            parts.add(row.url());
        }
        parts.add("조회일 " + row.collectedAt().atZoneSameInstant(KST).toLocalDate());
        return String.join(" · ", parts);
    }

    /** 기간 [start, end) 는 끝을 빼고 적는다: 연 단위 「2023–2025」, 월 단위 「2024-06」, 그 밖 날짜. 시점 자료는 한국 날짜. */
    private static String when(EvidenceRow row) {
        if (row.periodStart() != null) {
            LocalDate start = row.periodStart();
            LocalDate last = row.periodEnd().minusDays(1);
            if (start.getDayOfYear() == 1 && row.periodEnd().getDayOfYear() == 1) {
                return range(String.valueOf(start.getYear()), String.valueOf(last.getYear()));
            }
            if (start.getDayOfMonth() == 1 && row.periodEnd().getDayOfMonth() == 1) {
                return range(start.format(MONTH), last.format(MONTH));
            }
            return range(start.toString(), last.toString());
        }
        if (row.observedAt() != null) {
            return row.observedAt().atZoneSameInstant(KST).toLocalDate().toString();
        }
        return null;
    }

    private static String range(String first, String last) {
        return first.equals(last) ? first : first + "–" + last;
    }
}
