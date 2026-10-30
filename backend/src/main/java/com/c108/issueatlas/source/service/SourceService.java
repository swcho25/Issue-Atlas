package com.c108.issueatlas.source.service;

import com.c108.issueatlas.source.dto.SourceListResponse.SourceResponse;
import com.c108.issueatlas.source.dto.SourceListResponse.SpecResponse;
import com.c108.issueatlas.source.repository.SourceRepository;
import com.c108.issueatlas.source.repository.SourceRepository.SourceSpecRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SourceService {
    private final SourceRepository sources;

    public SourceService(SourceRepository sources) {
        this.sources = sources;
    }

    public List<SourceResponse> list() {
        return sources.findSourceSpecs().stream()
                .collect(
                        Collectors.groupingBy(
                                SourceSpecRow::sourceId, LinkedHashMap::new, Collectors.toList()))
                .values()
                .stream()
                .map(SourceService::toResponse)
                .toList();
    }

    private static SourceResponse toResponse(List<SourceSpecRow> rows) {
        SourceSpecRow source = rows.getFirst();
        List<SpecResponse> specs =
                rows.stream()
                        .filter(row -> row.specId() != null)
                        .map(
                                row ->
                                        new SpecResponse(
                                                row.specId(),
                                                row.method(),
                                                row.evidenceClass(),
                                                row.lastSuccessAt()))
                        .toList();
        return new SourceResponse(
                source.sourceId(),
                source.name(),
                source.org(),
                source.licenseType(),
                source.storageScope(),
                source.reliabilityGrade(),
                specs);
    }
}
