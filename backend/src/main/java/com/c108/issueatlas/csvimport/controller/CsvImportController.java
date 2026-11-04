package com.c108.issueatlas.csvimport.controller;

import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import com.c108.issueatlas.csvimport.service.CsvImportService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/admin")
public class CsvImportController {
    private final CsvImportService service;

    public CsvImportController(CsvImportService service) {
        this.service = service;
    }

    @GetMapping("/import-templates")
    public List<Template> templates() {
        return List.of(service.template());
    }

    @GetMapping("/import-templates/normalized-record/file")
    public ResponseEntity<byte[]> template() {
        return csv(service.templateFile(), "issueatlas-normalized-v1.csv");
    }

    @PostMapping(value = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Request upload(
            @RequestParam MultipartFile file,
            @RequestParam(name = "template_version") String version,
            @RequestParam(name = "assignee_id") long assignee,
            @RequestParam(name = "request_key") String key,
            Principal actor) {
        return service.upload(file, version, assignee, key, actor.getName());
    }

    @GetMapping("/imports")
    public Page list(
            @RequestParam(required = false) String status,
            @RequestParam(name = "assignee_id", required = false) Long assignee,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(status, assignee, page, size);
    }

    @GetMapping("/imports/{id}")
    public Detail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @GetMapping("/imports/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable String id) {
        return csv(service.file(id), "issueatlas-import.csv");
    }

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
