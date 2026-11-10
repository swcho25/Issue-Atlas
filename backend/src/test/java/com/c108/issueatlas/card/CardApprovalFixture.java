package com.c108.issueatlas.card;

import com.c108.issueatlas.card.dto.CardStorageDto.SaveDraft;
import com.c108.issueatlas.card.dto.CardStorageDto.SaveIndicator;
import com.c108.issueatlas.card.service.CardStorageService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

final class CardApprovalFixture {
    static final String WRITER = "approval-writer@test.local";
    static final String APPROVER = "approval-approver@test.local";
    static final String OTHER = "approval-other@test.local";

    static ObjectNode seed(JdbcTemplate jdbc, ObjectMapper json, CardStorageService storage)
            throws Exception {
        var c1 = json.readTree(Files.readString(Path.of("../contracts/cards/C1.json")));
        var a3 = json.readTree(Files.readString(Path.of("../contracts/cards/A3.json")));
        for (JsonNode row :
                json.readTree(Files.readString(Path.of("../contracts/cards/indicators.json")))
                        .path("indicators")) {
            String id = row.path("id").asText();
            JsonNode rule =
                    List.of(c1.path("rule"), a3.path("rule")).stream()
                            .filter(r -> id.equals(r.path("indicator_id").asText()))
                            .findFirst()
                            .orElse(null);
            JsonNode owner =
                    row.has("added_by_card")
                            ? row.path("added_by_card")
                            : row.path("cards").path(0);
            storage.saveIndicator(
                    id,
                    new SaveIndicator(
                            0,
                            row,
                            rule,
                            text(row, "numerator_id"),
                            text(row, "denominator_id"),
                            text(row, "base_id"),
                            owner.isMissingNode() || owner.isNull() ? null : owner.asText(),
                            false),
                    WRITER);
        }
        for (String email :
                List.of(
                        WRITER,
                        APPROVER,
                        OTHER,
                        "approval-viewer@test.local",
                        "approval-disabled@test.local")) {
            jdbc.update(
                    "INSERT INTO app_user(email,password_hash,name,role,is_active) VALUES (?,'test-only',?,?,?)",
                    email,
                    email,
                    email.contains("viewer") ? "VIEWER" : "ADMIN",
                    !email.contains("disabled"));
        }
        storage.saveDraft("C1", new SaveDraft(0L, c1), WRITER);
        return (ObjectNode) c1;
    }

    private static String text(JsonNode row, String key) {
        return row.hasNonNull(key) ? row.path(key).asText() : null;
    }
}
