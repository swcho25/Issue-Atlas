package com.c108.issueatlas.csvimport.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import com.c108.issueatlas.csvimport.repository.CsvImportRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class CsvImportService {
    private static final Set<String> STATES =
            Set.of("validation_failed", "no_changes", "pending", "completed", "failed");
    private final CsvImportRepository repository;

    public CsvImportService(CsvImportRepository repository) {
        this.repository = repository;
    }

    public Template template() {
        return new Template(
                "normalized-record",
                "1",
                CsvValidator.MAX_BYTES,
                CsvValidator.MAX_ROWS,
                CsvValidator.COLUMNS);
    }

    public byte[] templateFile() {
        return ("\uFEFF" + String.join(",", CsvValidator.COLUMNS) + "\r\n")
                .getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public Request upload(
            MultipartFile file, String version, long assignee, String key, String email) {
        if (!"1".equals(version)
                || key == null
                || !key.matches("[A-Za-z0-9_-]{1,128}")
                || assignee < 1
                || file.isEmpty()) throw error(HttpStatus.BAD_REQUEST);
        if (file.getSize() > CsvValidator.MAX_BYTES) throw error(HttpStatus.PAYLOAD_TOO_LARGE);
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("").replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (name.length() > 200
                || !name.toLowerCase(Locale.ROOT).endsWith(".csv")
                || name.chars().anyMatch(c -> c < 32 || c == 127))
            throw error(HttpStatus.BAD_REQUEST);
        byte[] bytes;
        try (var input = file.getInputStream()) {
            bytes = input.readNBytes(CsvValidator.MAX_BYTES + 1);
        } catch (java.io.IOException ex) {
            throw error(HttpStatus.BAD_REQUEST);
        }
        if (bytes.length > CsvValidator.MAX_BYTES) throw error(HttpStatus.PAYLOAD_TOO_LARGE);
        long actor = repository.actor(email);
        if (actor < 1) throw error(HttpStatus.FORBIDDEN);
        String hash = hash(bytes);
        String fingerprint =
                hash(
                        (hash + ":" + assignee + ":" + version + ":" + name)
                                .getBytes(StandardCharsets.UTF_8));
        repository.keyLock(actor, key);
        var replay = repository.replay(actor, key, fingerprint);
        if (replay.isPresent()) {
            if (replay.get().equals("conflict")) throw error(HttpStatus.CONFLICT);
            return get(replay.get(), false);
        }
        if (!repository.assignee(assignee)) throw error(HttpStatus.BAD_REQUEST);
        var parsed = CsvValidator.parse(bytes);
        var validation =
                CsvValidator.validate(
                        parsed,
                        repository.catalog(),
                        repository.duplicates(CsvValidator.keys(parsed)));
        String status =
                validation.errorCount() > 0
                        ? "validation_failed"
                        : validation.eligibleRows() == 0 ? "no_changes" : "pending";
        String id = "import_" + UUID.randomUUID();
        repository.create(
                id, actor, assignee, key, fingerprint, name, hash, bytes, status, validation);
        return get(id, false);
    }

    private static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private Request get(String id, boolean lock) {
        return repository.find(id, lock).orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page list(String status, Long assignee, int page, int size) {
        if (page < 1
                || size < 1
                || size > 100
                || status != null && !STATES.contains(status)
                || assignee != null && assignee < 1) throw error(HttpStatus.BAD_REQUEST);
        return repository.list(status, assignee, page, size);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Detail detail(String id) {
        return new Detail(get(id, false), repository.result(id).orElse(null));
    }

    public byte[] file(String id) {
        get(id, false);
        return repository.file(id);
    }

    @Transactional
    public Detail finish(String id, Finish in, String email) {
        Request request = get(id, true);
        long actor = repository.actor(email);
        if (actor < 1 || actor != request.assigneeId()) throw error(HttpStatus.FORBIDDEN);
        if (!request.status().equals("pending") || request.revision() != in.expectedRevision())
            throw error(HttpStatus.CONFLICT);
        int eligible = request.validation().path("eligible_rows").asInt();
        long counted = (long) in.loadedRows() + in.skippedRows();
        if (counted > eligible || in.status().equals("completed") && counted != eligible)
            throw error(HttpStatus.BAD_REQUEST);
        repository.finish(id, actor, in);
        return detail(id);
    }

    private static ErrorResponseException error(HttpStatus status) {
        return new ErrorResponseException(status);
    }
}
