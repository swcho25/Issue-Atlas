package com.c108.issueatlas.card.service;

import com.c108.issueatlas.card.dto.CardStorageDto.*;
import com.c108.issueatlas.card.repository.CardStorageRepository;
import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.judgment.RuleType;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
@Transactional(readOnly = true)
public class CardStorageService {
    private final CardStorageRepository storage;
    private final Map<String, RuleType> ruleTypes;

    public CardStorageService(CardStorageRepository storage, List<RuleType> ruleTypes) {
        this.storage = storage;
        this.ruleTypes =
                ruleTypes.stream().collect(Collectors.toMap(RuleType::ruleId, Function.identity()));
    }

    @Transactional
    public CardDraft create(CreateCard request, String actor) {
        if (!request.domain().startsWith(request.cardId().substring(0, 1))) badRequest();
        return write(
                () -> {
                    storage.create(request, actor);
                    return draft(request.cardId());
                });
    }

    public CardDraft draft(String id) {
        return storage.draft(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional
    public CardDraft saveDraft(String id, SaveDraft request, String actor) {
        draft(id);
        if (!request.spec().isObject()) badRequest();
        ObjectNode spec = (ObjectNode) request.spec().deepCopy();
        for (String key :
                List.of(
                        "card_id",
                        "card_version",
                        "status",
                        "taxonomy_version",
                        "rule",
                        "card_approval",
                        "indicator_snapshots")) spec.remove(key);
        spec.put("author", actor);
        return write(
                () -> {
                    if (storage.saveDraft(id, request.expectedRevision(), spec.toString(), actor)
                            != 1) conflict();
                    return draft(id);
                });
    }

    public Validation check(String id) {
        CardDraft draft = draft(id);
        List<Check> checks = storage.check(draft.draftSpec().toString());
        return new Validation(draft.draftRevision(), checks.stream().allMatch(Check::ok), checks);
    }

    @Transactional
    public Version approve(String id, Approve request, String actor) {
        return write(
                () -> {
                    if (!storage.lockCardForApproval(id)) throw new ResourceNotFoundException();
                    CardDraft draft = draft(id);
                    if (draft.draftRevision() != request.expectedRevision()) conflict();
                    storage.lockIndicatorsForApproval();
                    validateRule(draft.draftSpec());
                    return version(
                            id,
                            storage.approve(
                                    id, actor, request.expectedRevision(), request.reason()));
                });
    }

    private void validateRule(JsonNode draft) {
        JsonNode items = draft.path("claim_items");
        if (!items.isArray()) badRequest();
        String main = null;
        for (JsonNode item : items) {
            if (!"main".equals(item.path("role").asText())) continue;
            if (main != null) badRequest();
            main = item.path("indicator_id").asText();
        }
        if (main == null || main.isBlank()) badRequest();
        Indicator indicator = storage.indicator(main).orElse(null);
        if (indicator == null || indicator.rule() == null) badRequest();
        JsonNode rule = indicator.rule();
        if (!main.equals(rule.path("indicator_id").asText())) badRequest();
        RuleType type = ruleTypes.get(rule.path("rule_id").asText());
        if (type == null) badRequest();
        try {
            type.validate(rule);
        } catch (IllegalArgumentException ex) {
            badRequest();
        }
    }

    public Version version(String id, int version) {
        return storage.version(id, version).orElseThrow(ResourceNotFoundException::new);
    }

    public List<Revision> revisions(String id) {
        draft(id);
        return storage.revisions(id);
    }

    public Indicator indicator(String id) {
        return storage.indicator(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional
    public Indicator saveIndicator(String id, SaveIndicator request, String actor) {
        if (!id.matches("[A-Za-z0-9_]+") || !request.definition().isObject()) badRequest();
        if (request.expectedRuleVersion() > 0) indicator(id);
        return write(
                () -> {
                    if (storage.saveIndicator(id, request, actor) != 1) conflict();
                    return indicator(id);
                });
    }

    private static <T> T write(Supplier<T> action) {
        try {
            return action.get();
        } catch (DataAccessException ex) {
            if (ex.getMostSpecificCause() instanceof SQLException sql) {
                String state = sql.getSQLState();
                if ("P0002".equals(state)) throw new ResourceNotFoundException();
                if ("40001".equals(state) || "23505".equals(state)) conflict();
                if ("23514".equals(state) || "23503".equals(state) || "23502".equals(state))
                    badRequest();
            }
            throw ex;
        }
    }

    private static void conflict() {
        throw new ErrorResponseException(HttpStatus.CONFLICT);
    }

    private static void badRequest() {
        throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
    }
}
