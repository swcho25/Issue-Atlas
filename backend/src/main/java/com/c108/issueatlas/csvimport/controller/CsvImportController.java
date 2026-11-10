package com.c108.issueatlas.csvimport.controller;

import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import com.c108.issueatlas.csvimport.service.CsvImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "admin")
@RestController
@RequestMapping("/v1/admin")
public class CsvImportController {
    private final CsvImportService service;

    public CsvImportController(CsvImportService service) {
        this.service = service;
    }

    @Operation(summary = "CSV 가져오기 양식 목록")
    @GetMapping("/import-templates")
    public List<Template> templates() {
        return List.of(service.template());
    }

    @Operation(summary = "CSV 양식 파일 내려받기 (UTF-8 BOM 헤더)")
    @GetMapping("/import-templates/normalized-record/file")
    public ResponseEntity<byte[]> template() {
        return csv(service.templateFile(), "issueatlas-normalized-v1.csv");
    }

    @Operation(summary = "CSV 업로드 (담당자 지정, 같은 request_key 재시도도 201)")
    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Request upload(
            @Parameter(
                            description =
                                    "업로드할 CSV (양식: GET /v1/admin/import-templates/normalized-record/file)")
                    @RequestParam
                    MultipartFile file,
            @RequestParam(name = "template_version") String version,
            @RequestParam(name = "assignee_id") long assignee,
            @RequestParam(name = "request_key") String key,
            Principal actor) {
        return service.upload(file, version, assignee, key, actor.getName());
    }

    @Operation(summary = "CSV 가져오기 요청 목록")
    @GetMapping("/imports")
    public Page list(
            @RequestParam(required = false) String status,
            @RequestParam(name = "assignee_id", required = false) Long assignee,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(status, assignee, page, size);
    }

    @Operation(summary = "CSV 가져오기 요청 상세와 처리 결과")
    @GetMapping("/imports/{id}")
    public Detail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @Operation(summary = "업로드한 원본 CSV 내려받기")
    @GetMapping("/imports/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable String id) {
        return csv(service.file(id), "issueatlas-import.csv");
    }

    @Operation(summary = "CSV 처리 결과 보고 (담당자)")
    @PostMapping("/imports/{id}/results")
    public Detail finish(
            @PathVariable String id, @Valid @RequestBody Finish input, Principal actor) {
        return service.finish(id, input, actor.getName());
    }

    private ResponseEntity<byte[]> csv(byte[] data, String name) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(data);
    }
}
