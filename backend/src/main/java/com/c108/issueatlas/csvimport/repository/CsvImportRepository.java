package com.c108.issueatlas.csvimport.repository;

import com.c108.issueatlas.csvimport.dto.CsvImportDto.*;
import java.util.*;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class CsvImportRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public CsvImportRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public long actor(String email) {
        return jdbc.sql(
                        "SELECT id FROM app_user WHERE email=? AND role='ADMIN' AND is_active FOR SHARE")
                .param(email)
                .query(Long.class)
                .optional()
                .orElse(-1L);
    }

    public boolean assignee(long id) {
        return jdbc.sql(
                        "SELECT id FROM app_user WHERE id=? AND role='ADMIN' AND is_active FOR SHARE")
                .param(id)
                .query(Long.class)
                .optional()
                .isPresent();
    }

    public void keyLock(long actor, String key) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(?,0))")
                .param(actor + ":" + key)
                .query((rs, n) -> true)
                .single();
    }

    public Optional<String> replay(long actor, String key, String fingerprint) {
        var rows =
                jdbc.sql(
                                "SELECT import_id,fingerprint FROM csv_import_request WHERE requested_by=? AND request_key=?")
                        .params(actor, key)
                        .query((rs, n) -> Map.entry(rs.getString(1), rs.getString(2)))
                        .list();
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(
                rows.getFirst().getValue().equals(fingerprint)
                        ? rows.getFirst().getKey()
                        : "conflict");
    }

    public void create(
            String id,
            long actor,
            long assignee,
            String key,
            String fingerprint,
            String name,
            String hash,
            byte[] data,
            String status,
            Validation validation) {
        jdbc.sql(
                        """
            INSERT INTO csv_import_request(import_id,requested_by,assignee_id,request_key,
                fingerprint,file_name,file_sha256,file_data,template_version,status,validation)
            VALUES (?,?,?,?,?,?,?,?,'1',?,CAST(? AS jsonb))
            """)
                .params(
                        id,
                        actor,
                        assignee,
                        key,
                        fingerprint,
                        name,
                        hash,
                        data,
                        status,
                        json.writeValueAsString(validation))
                .update();
    }

    private RowMapper<Request> mapper() {
        return (r, n) ->
                new Request(
                        r.getString("import_id"),
                        r.getLong("requested_by"),
                        r.getLong("assignee_id"),
                        r.getString("file_name"),
                        r.getString("file_sha256"),
                        r.getString("template_version"),
                        r.getString("status"),
                        r.getLong("revision"),
                        json.readTree(r.getString("validation")),
                        r.getObject("created_at", java.time.OffsetDateTime.class),
                        r.getObject("updated_at", java.time.OffsetDateTime.class));
    }

    public Optional<Request> find(String id, boolean lock) {
        return jdbc.sql(
                        "SELECT import_id,requested_by,assignee_id,file_name,file_sha256,template_version,status,revision,validation,created_at,updated_at FROM csv_import_request WHERE import_id=?"
                                + (lock ? " FOR UPDATE" : ""))
                .param(id)
                .query(mapper())
                .optional();
    }

    public Page list(String status, Long assignee, int page, int size) {
        String filter =
                " WHERE (CAST(:status AS text) IS NULL OR status=:status) AND (CAST(:assignee AS bigint) IS NULL OR assignee_id=:assignee)";
        var items =
                jdbc.sql(
                                "SELECT import_id,requested_by,assignee_id,file_name,file_sha256,template_version,status,revision,validation,created_at,updated_at FROM csv_import_request"
                                        + filter
                                        + " ORDER BY created_at DESC,import_id DESC LIMIT :size OFFSET :offset")
                        .param("status", status)
                        .param("assignee", assignee)
                        .param("size", size)
                        .param("offset", (page - 1L) * size)
                        .query(mapper())
                        .list();
        long total =
                jdbc.sql("SELECT count(*) FROM csv_import_request" + filter)
                        .param("status", status)
                        .param("assignee", assignee)
                        .query(Long.class)
                        .single();
        return new Page(items, total, page, size);
    }

    public byte[] file(String id) {
        return jdbc.sql("SELECT file_data FROM csv_import_request WHERE import_id=?")
                .param(id)
                .query((r, n) -> r.getBytes(1))
                .single();
    }

    public Optional<Result> result(String id) {
        return jdbc.sql(
                        "SELECT status,actor_id,reason,loaded_rows,skipped_rows,created_at FROM csv_import_result WHERE import_id=?")
                .param(id)
                .query(Result.class)
                .optional();
    }

    public void finish(String id, long actor, Finish in) {
        jdbc.sql(
                        "INSERT INTO csv_import_result(import_id,actor_id,status,reason,loaded_rows,skipped_rows) VALUES (?,?,?,?,?,?)")
                .params(
                        id,
                        actor,
                        in.status(),
                        in.reason().strip(),
                        in.loadedRows(),
                        in.skippedRows())
                .update();
        jdbc.sql(
                        "UPDATE csv_import_request SET status=?,revision=revision+1,updated_at=now() WHERE import_id=?")
                .params(in.status(), id)
                .update();
    }

    public record Catalog(
            Set<String> sources,
            Map<String, String> specs,
            Set<String> places,
            Set<String> cards,
            Set<String> indicators) {}

    public Catalog catalog() {
        return new Catalog(
                new HashSet<>(jdbc.sql("SELECT source_id FROM source").query(String.class).list()),
                jdbc
                        .sql("SELECT spec_id,source_id FROM source_spec")
                        .query((r, n) -> Map.entry(r.getString(1), r.getString(2)))
                        .list()
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        Map.Entry::getKey, Map.Entry::getValue)),
                new HashSet<>(jdbc.sql("SELECT place_id FROM place").query(String.class).list()),
                new HashSet<>(jdbc.sql("SELECT card_id FROM card").query(String.class).list()),
                new HashSet<>(
                        jdbc.sql("SELECT indicator_id FROM indicator").query(String.class).list()));
    }

    public Set<String> duplicates(Set<String> keys) {
        if (keys.isEmpty()) return Set.of();
        return new HashSet<>(
                jdbc.sql(
                                "SELECT DISTINCT dedup_key FROM normalized_record WHERE dedup_key IN (:keys)")
                        .param("keys", keys)
                        .query(String.class)
                        .list());
    }
}
