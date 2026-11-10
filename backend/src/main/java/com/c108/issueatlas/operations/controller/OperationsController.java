package com.c108.issueatlas.operations.controller;

import com.c108.issueatlas.operations.dto.OperationsDto.*;
import com.c108.issueatlas.operations.service.OperationsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/admin")
@Tag(name = "admin")
public class OperationsController {
    private final OperationsService service;

    public OperationsController(OperationsService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    @Operation(
            summary = "운영 요약",
            description = "현재 대기 상태·자료 건수와 [from,to) 기간 내 처리 기록을 구분한다. 기간 기본값은 최근 7일.")
    public Overview overview(
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to) {
        return service.overview(from, to);
    }

    @GetMapping("/argument-runs")
    @Operation(summary = "저장된 분석 실행 목록", description = "지역·카드·기간은 일치 조건. 새로운 분석을 실행하지 않는다.")
    public Page runs(
            @RequestParam(name = "place_id", required = false) String place,
            @RequestParam(name = "card_id", required = false) String card,
            @RequestParam(name = "period_start", required = false) LocalDate start,
            @RequestParam(name = "period_end", required = false) LocalDate end,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.runs(new RunFilter(place, card, start, end), page, size);
    }

    @GetMapping("/run-comparisons")
    @Operation(
            summary = "저장된 분석 결과 비교",
            description = "같은 지역·카드·기간의 두 실행을 비교한다. 당시 기록이 없는 지표는 null과 사유를 반환한다. 응답 시간은 제외한다.")
    public Comparison compare(
            @RequestParam(name = "before_run_id") String before,
            @RequestParam(name = "after_run_id") String after) {
        return service.compare(before, after);
    }
}
