package com.c108.issueatlas.card.service;

import com.c108.issueatlas.card.repository.CardRepository;
import com.c108.issueatlas.card.repository.CardRepository.CardEvidenceRow;
import com.c108.issueatlas.card.repository.CardRepository.ResponseCount;
import com.c108.issueatlas.judgment.RuleType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 근거 수요표 4종 상태 규칙 — 질문 실행과 카드 목록 ②가 같이 쓴다(저장하지 않는다). 질문 실행은 근거 행을 만든 뒤 이은 수로, 카드 목록은 같은 고르기
 * SQL({@link com.c108.issueatlas.card.repository.EvidenceMatchSql})로 센 수로 {@link #resolve} 를 부른다.
 * 그래서 같은 지역 · 기간 · 카드 판이면 두 화면의 상태가 같다. 등록된 확보 상태(card_evidence_status, not_published 등)가 먼저다.
 */
@Service
public class CardEvidenceStatus {
    public static final List<String> KINDS =
            List.of("statistics", "documents", "existing_responses", "denominators");

    private final CardRepository cards;
    private final ObjectMapper json;
    private final Set<String> ruleIds;

    public CardEvidenceStatus(CardRepository cards, ObjectMapper json, List<RuleType> types) {
        this.cards = cards;
        this.json = json;
        this.ruleIds = types.stream().map(RuleType::ruleId).collect(Collectors.toSet());
    }

    /** 카드 목록 ②: 카드 한 판의 4종 상태를 근거 행을 만들지 않고 센다. registered 는 그 판의 등록 상태 줄(종류 → 행). */
    public List<KindStatus> count(
            String cardId,
            int version,
            Map<String, CardEvidenceRow> registered,
            String placeId,
            LocalDate start,
            LocalDate end) {
        JsonNode spec = cards.approvedSpec(cardId, version).map(json::readTree).orElse(null);
        KindStatus statistics = statistics(registered, spec, placeId, start, end);
        ResponseCount responses = cards.responseCount(cardId, placeId, start, end);
        boolean judged = judged(spec, statistics);
        Linked linked =
                new Linked(
                        responses.linked(),
                        responses.pending(),
                        judged ? documents(spec, placeId, start, end) : 0,
                        judged ? denominators(spec, placeId, start, end) : 0);
        return List.copyOf(resolve(registered, statistics, linked).values());
    }

    /**
     * 통계 줄. 등록 상태가 not_collected(등록 없음 포함)이고 승인본이 있으면 규칙 주 지표의 월 관측으로 정한다 — available 한 달이 있으면
     * available, 없고 미공표 달이 있으면 not_published. 등록된 available · not_published 는 그 값이 먼저다. 질문 실행은 이 값이
     * available 일 때만 판정한다.
     */
    public KindStatus statistics(
            Map<String, CardEvidenceRow> registered,
            JsonNode spec,
            String placeId,
            LocalDate start,
            LocalDate end) {
        KindStatus row = registered(registered, "statistics");
        if (spec == null || !"not_collected".equals(row.status())) {
            return row;
        }
        // ponytail: 카드 확보 상태를 쓰는 곳(P3/P4)이 아직 없어 규칙 주 지표의 관측 행으로 정한다
        String observed =
                cards.statisticsStatus(
                        spec.path("rule").path("indicator_id").asText(), placeId, start, end);
        return new KindStatus("statistics", observed, 0);
    }

    /**
     * 4종 상태. 기존 대응은 이은 후보가 있으면 available, 등급 없는 후보만 있으면 review_pending(보류 수 = 그 후보 수), 없으면 등록 상태.
     * 문서 · 분모는 판정이 이은 근거가 있고 등록 상태가 not_collected(등록 없음 포함)면 available — 통계와 같은 임시 방식(P3/P4 전). 등록된
     * not_published · license_blocked 는 그대로.
     */
    public static Map<String, KindStatus> resolve(
            Map<String, CardEvidenceRow> registered, KindStatus statistics, Linked linked) {
        Map<String, KindStatus> result = new LinkedHashMap<>();
        result.put("statistics", statistics);
        result.put("documents", linkedOrRegistered(registered, "documents", linked.documents()));
        KindStatus responses = registered(registered, "existing_responses");
        if (linked.responses() > 0 || linked.pendingResponses() > 0) {
            responses =
                    new KindStatus(
                            "existing_responses",
                            linked.responses() > 0 ? "available" : "review_pending",
                            linked.pendingResponses());
        }
        result.put("existing_responses", responses);
        result.put(
                "denominators",
                linkedOrRegistered(registered, "denominators", linked.denominators()));
        return result;
    }

    /** 질문 실행이 규칙 판정까지 가는가(승인본 · 지원하는 규칙 · 통계 available). 판정하지 않으면 문서 · 분모를 잇지 않는다. */
    private boolean judged(JsonNode spec, KindStatus statistics) {
        return spec != null
                && "available".equals(statistics.status())
                && ruleIds.contains(spec.path("rule").path("rule_id").asText());
    }

    private int documents(JsonNode spec, String placeId, LocalDate start, LocalDate end) {
        List<String> specs = new ArrayList<>();
        spec.path("evidence")
                .path("documents")
                .forEach(source -> specs.add(source.path("spec_id").asText()));
        specs.removeIf(String::isBlank);
        List<String> keywords = new ArrayList<>();
        spec.path("keywords").forEach(keyword -> keywords.add(keyword.asText()));
        return cards.pressCount(specs, keywords, placeId, start, end);
    }

    /** 승인본 분모 지표마다 이을 수 있는 근거 수. 같은 명세 · 지표는 같은 근거 한 행이라 한 번만 센다. */
    private int denominators(JsonNode spec, String placeId, LocalDate start, LocalDate end) {
        Set<List<String>> seen = new LinkedHashSet<>();
        for (JsonNode source : spec.path("evidence").path("denominators")) {
            String specId = source.path("spec_id").asText();
            String indicatorId = source.path("indicator_id").asText();
            if (!specId.isBlank() && !indicatorId.isBlank()) {
                seen.add(List.of(specId, indicatorId));
            }
        }
        return (int)
                seen.stream()
                        .filter(
                                key ->
                                        cards.denominatorLinked(
                                                key.get(0), key.get(1), placeId, start, end))
                        .count();
    }

    private static KindStatus linkedOrRegistered(
            Map<String, CardEvidenceRow> registered, String kind, int linked) {
        KindStatus row = registered(registered, kind);
        return linked > 0 && "not_collected".equals(row.status())
                ? new KindStatus(kind, "available", 0)
                : row;
    }

    private static KindStatus registered(Map<String, CardEvidenceRow> registered, String kind) {
        CardEvidenceRow row = registered.get(kind);
        return row == null
                ? new KindStatus(kind, "not_collected", 0)
                : new KindStatus(kind, row.status(), row.reviewPendingCount());
    }

    /** 한 종류의 상태와 보류 항목 수. */
    public record KindStatus(String kind, String status, int reviewPendingCount) {}

    /**
     * 이은 근거 수. responses · pendingResponses = 이은 · 등급 없어 보류한 기존 대응 후보, documents · denominators =
     * 판정이 이은 근거(판정하지 않으면 0).
     */
    public record Linked(int responses, int pendingResponses, int documents, int denominators) {}
}
