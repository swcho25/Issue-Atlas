package com.c108.issueatlas.question.service;

import com.c108.issueatlas.judgment.Evaluation;
import com.c108.issueatlas.judgment.RuleType;
import com.c108.issueatlas.judgment.YearValues;
import com.c108.issueatlas.question.dto.ApprovedCard;
import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import com.c108.issueatlas.question.dto.ArgumentResponse.Condition;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.ObservationRow;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** 불변 승인본의 규칙과 지표 정의로 실행을 조립한다. 카드별 코드는 두지 않는다. */
@Component
public class CardJudge {
    private final QuestionRepository questions;
    private final Map<String, RuleType> types;

    public CardJudge(QuestionRepository questions, List<RuleType> types) {
        this.questions = questions;
        this.types =
                types.stream().collect(Collectors.toMap(RuleType::ruleId, Function.identity()));
    }

    public Optional<Judgment> judge(
            ApprovedCard card, String placeId, LocalDate start, LocalDate end) {
        JsonNode spec = card.spec();
        JsonNode rule = spec.path("rule");
        RuleType type = types.get(rule.path("rule_id").asText());
        if (type == null) return Optional.empty();
        type.validate(rule);
        String indicatorId = rule.path("indicator_id").asText();
        JsonNode definition = definition(spec, indicatorId);
        List<ObservationRow> rows = questions.observationRows(indicatorId, placeId, start, end);
        YearValues values = AnnualRollup.apply(rows, definition, start, end);
        String placeName = questions.placeName(placeId).orElse(placeId);
        Evaluation evaluation = type.evaluate(values, rule);
        JsonNode outcome = outcome(rule, evaluation);
        String claim = outcome.path("claim").asText();
        int yearCount = (int) evaluation.facts().getOrDefault("yearCount", 0);
        int minimum = rule.path("min_years").asInt();
        Condition indicator =
                new Condition(true, spec.path("comparability").path("same_indicator").asText());
        Condition period =
                new Condition(
                        yearCount >= minimum,
                        "판정 가능한 연 값 " + yearCount + "개(" + minimum + "개 이상 필요)");
        Condition boundary =
                new Condition(
                        evaluation.sameBoundary(),
                        spec.path("comparability").path("same_boundary").asText());
        Condition method =
                new Condition(true, spec.path("comparability").path("same_method").asText());
        String sourceSpec =
                spec.path("evidence").path("statistics").path(0).path("spec_id").asText();
        List<String> statistics =
                sourceSpec.isBlank()
                        ? List.of()
                        : questions
                                .statisticsEvidence(
                                        sourceSpec,
                                        indicatorId,
                                        definition.path("label").asText(),
                                        placeId,
                                        start,
                                        end,
                                        display(placeName, definition, rows, values, start, end))
                                .map(List::of)
                                .orElse(List.of());
        List<String> denominators = new ArrayList<>();
        for (JsonNode source : spec.path("evidence").path("denominators")) {
            String denominatorSpec = source.path("spec_id").asText();
            String denominatorId = source.path("indicator_id").asText();
            if (denominatorSpec.isBlank() || denominatorId.isBlank()) continue;
            questions
                    .denominatorEvidence(
                            denominatorSpec,
                            denominatorId,
                            label(spec, denominatorId),
                            placeId,
                            start,
                            end,
                            denominatorDisplay(spec, denominatorId, placeName, placeId, start, end))
                    .filter(id -> !denominators.contains(id))
                    .ifPresent(denominators::add);
        }
        // 문서 ②: 카드 문서 명세의 보도자료 중 제목이 카드 키워드에 맞는 글. 빅카인즈 기사는 articles[](P4 카드 태그)로 따로 낸다
        List<String> documentSpecs = new ArrayList<>();
        spec.path("evidence")
                .path("documents")
                .forEach(source -> documentSpecs.add(source.path("spec_id").asText()));
        documentSpecs.removeIf(String::isBlank);
        List<String> keywords = new ArrayList<>();
        spec.path("keywords").forEach(keyword -> keywords.add(keyword.asText()));
        List<String> documents =
                questions.pressEvidence(
                        card.cardId(), documentSpecs, keywords, placeId, start, end);
        String level =
                switch (claim) {
                    case "insufficient" -> "insufficient_evidence";
                    case "not_comparable" -> "observed_fact";
                    default -> spec.path("max_claim_level").asText();
                };
        return Optional.of(
                new Judgment(
                        claim,
                        level,
                        definition.path("label").asText(),
                        outcome.path("label").asText(),
                        outcome.path("claim_text").isString()
                                ? outcome.path("claim_text").asText()
                                : null,
                        new Comparability(indicator, period, boundary, method),
                        statistics,
                        documents,
                        List.copyOf(denominators),
                        evaluation.facts(),
                        indicatorId,
                        definition.path("unit").asText(),
                        values));
    }

    /** 승인본 지표 사본의 이름. 사본이 없는 지표(분모 등)는 null. */
    /** 근거 상세 「이 질문에 쓴 값」: 판정에 쓴 연 값 문장. 측정소 이름은 place 에서 읽는다 */
    private String display(
            String placeName,
            JsonNode definition,
            List<ObservationRow> rows,
            YearValues values,
            LocalDate start,
            LocalDate end) {
        List<String> stations =
                rows.stream()
                        .map(ObservationRow::stationId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        return EvidenceDisplay.annual(
                placeName, definition, rows, values, questions.placeNames(stations), start, end);
    }

    /** 분모도 지표 정의(roll)로 연 값을 묶는다. 승인본 사본 → 지표 사전 순. 정의가 없으면 문장을 만들지 않는다 */
    private String denominatorDisplay(
            JsonNode spec,
            String indicatorId,
            String placeName,
            String placeId,
            LocalDate start,
            LocalDate end) {
        JsonNode definition = null;
        for (JsonNode snapshot : spec.path("indicator_snapshots")) {
            if (indicatorId.equals(snapshot.path("indicator_id").asText())) {
                definition = snapshot.path("definition");
            }
        }
        if (definition == null)
            definition = questions.indicatorDefinition(indicatorId).orElse(null);
        if (definition == null || definition.path("roll").isMissingNode()) return null;
        List<ObservationRow> rows = questions.observationRows(indicatorId, placeId, start, end);
        return display(
                placeName,
                definition,
                rows,
                AnnualRollup.apply(rows, definition, start, end),
                start,
                end);
    }

    private static String label(JsonNode spec, String indicatorId) {
        for (JsonNode snapshot : spec.path("indicator_snapshots")) {
            if (indicatorId.equals(snapshot.path("indicator_id").asText())) {
                JsonNode label = snapshot.path("definition").path("label");
                return label.isMissingNode() || label.isNull() ? null : label.asText();
            }
        }
        return null;
    }

    private static JsonNode definition(JsonNode spec, String indicatorId) {
        for (JsonNode snapshot : spec.path("indicator_snapshots")) {
            if (indicatorId.equals(snapshot.path("indicator_id").asText())) {
                return snapshot.path("definition");
            }
        }
        throw new IllegalStateException("Approved card has no main indicator snapshot");
    }

    private static JsonNode outcome(JsonNode rule, Evaluation evaluation) {
        for (JsonNode candidate : rule.path("outcomes")) {
            String when = candidate.path("when").asText();
            if (evaluation.holds().contains(when) || "otherwise".equals(when)) return candidate;
        }
        throw new IllegalStateException("Approved rule has no matching outcome");
    }

    /**
     * values: 판정에 쓴 연 값(계열 = 시군구 하나 또는 측정소마다). 문장화 입력의 statistics_points 가 된다. claimText: 고른 결과의 판단
     * ① 문장 틀(승인본 outcomes[].claim_text). 없으면 null 이고 claim_template 을 쓴다
     */
    public record Judgment(
            String claim,
            String level,
            String indicator,
            String label,
            String claimText,
            Comparability comparability,
            List<String> statistics,
            List<String> documents,
            List<String> denominators,
            Map<String, Object> facts,
            String indicatorId,
            String unit,
            YearValues values) {}
}
