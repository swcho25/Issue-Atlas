package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.client.ArgumentEngineClient;
import com.c108.issueatlas.question.client.ArgumentEngineClient.Reply;
import com.c108.issueatlas.question.dto.ApprovedCard;
import com.c108.issueatlas.question.dto.ArgumentResponse;
import com.c108.issueatlas.question.dto.ArgumentResponse.Rebuttal;
import com.c108.issueatlas.question.dto.ArgumentResponse.Text;
import com.c108.issueatlas.question.repository.QuestionRepository.PhrasingRow;
import com.c108.issueatlas.question.service.CardJudge.Judgment;
import com.c108.issueatlas.question.service.PhrasingCache.Lookup;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 논증 카드 ③ 보증 · ⑤ 반박 문장화(S15P31C108-231, contracts/ai v0.2 「문장화」). 규칙 판정이 끝난 응답을 판정 입력으로 바꿔 engine 에
 * 보내고, 결과가 done 일 때만 두 칸을 바꿔 쓴다. 판정 · 수치 · 다른 칸은 건드리지 않는다. 못 받으면 카드 문구 그대로 + 사유 코드. 같은 입력의 done 결과는
 * {@link PhrasingCache} 로 다시 쓴다.
 */
@Component
public class ArgumentPhraser {
    private static final Logger log = LoggerFactory.getLogger(ArgumentPhraser.class);
    static final String JUDGMENT_VERSION = "ai-judgment-input-0.1";
    // C2 응답에서 판정 입력으로 그대로 옮기는 칸
    private static final List<String> FIELDS =
            List.of(
                    "run_id",
                    "question",
                    "card_version",
                    "formula_version",
                    "taxonomy_version",
                    "run_status",
                    "evidence_table",
                    "comparability",
                    "claim",
                    "qualifier",
                    "data",
                    "warrant",
                    "ceiling");
    private static final Set<String> STATUSES = Set.of("done", "skipped", "failed");
    private static final Set<String> REASONS =
            Set.of(
                    "RUN_BLOCKED",
                    "RUN_UNSUPPORTED",
                    "NOT_JUDGED",
                    "INPUT_INVALID",
                    "LLM_TIMEOUT",
                    "LLM_ERROR",
                    "OUTPUT_REJECTED");

    private final ArgumentEngineClient engine;
    private final PhrasingCache cache;
    private final ObjectMapper json;

    public ArgumentPhraser(ArgumentEngineClient engine, PhrasingCache cache, ObjectMapper json) {
        this.engine = engine;
        this.cache = cache;
        this.json = json;
    }

    /** judgment 는 규칙이 판정했을 때만 있다(연 값). 없으면 engine 이 RUN_* · NOT_JUDGED 로 건너뛴다. */
    public Phrased phrase(ArgumentResponse result, ApprovedCard approved, Judgment judgment) {
        long started = System.nanoTime();
        ObjectNode request = request(result, approved, judgment);
        Lookup lookup = cache.get(request, () -> engine.phrase(request), ArgumentPhraser::reusable);
        int durationMs = (int) ((System.nanoTime() - started) / 1_000_000);
        Phrased phrased = apply(result, lookup.reply(), durationMs);
        log.info(
                "argument_phrasing {} {} {} {}ms {}",
                result.runId(),
                phrased.row().status(),
                phrased.row().reasonCode() == null ? "-" : phrased.row().reasonCode(),
                durationMs,
                lookup.source().name().toLowerCase(Locale.ROOT));
        return phrased;
    }

    /** 다시 써도 되는 결과: done 이고 바꿔 쓸 두 칸이 모양대로 있다. 실패 · 시간 초과 · 건너뜀은 다음 질문이 다시 부른다. */
    static boolean reusable(Reply reply) {
        JsonNode r = reply.result();
        return r != null
                && "done".equals(r.path("status").asText())
                && r.path("warrant").isObject()
                && r.path("rebuttals").isArray();
    }

    private Phrased apply(ArgumentResponse result, Reply reply, int durationMs) {
        JsonNode r = reply.result();
        String status = r == null ? null : r.path("status").asText();
        String reason =
                r == null || r.path("reason_code").isNull() ? null : r.path("reason_code").asText();
        if (r == null
                || !STATUSES.contains(status)
                || (reason != null && !REASONS.contains(reason))) {
            String failure = r == null ? reply.failure() : "ENGINE_ERROR";
            PhrasingRow row =
                    new PhrasingRow(
                            failure.equals("ENGINE_DISABLED") ? "skipped" : "failed",
                            failure,
                            "[]",
                            "{}",
                            null,
                            null,
                            durationMs);
            return new Phrased(result.warrant(), result.rebuttals(), row);
        }
        PhrasingRow row =
                new PhrasingRow(
                        status,
                        reason,
                        r.path("problems").isArray() ? r.get("problems").toString() : "[]",
                        r.path("citations").isObject() ? r.get("citations").toString() : "{}",
                        r.path("model").isString() ? r.get("model").asText() : null,
                        r.path("prompt_version").isString()
                                ? r.get("prompt_version").asText()
                                : null,
                        durationMs);
        if (!status.equals("done")) {
            return new Phrased(result.warrant(), result.rebuttals(), row);
        }
        try {
            return new Phrased(
                    json.treeToValue(r.get("warrant"), Text.class),
                    List.of(json.treeToValue(r.get("rebuttals"), Rebuttal[].class)),
                    row);
        } catch (JacksonException | IllegalArgumentException e) {
            return apply(result, new Reply(null, "ENGINE_ERROR"), durationMs);
        }
    }

    /** contracts/ai phrasing-request: 판정 입력 + 그 실행의 articles[] + 카드 승인본. */
    ObjectNode request(ArgumentResponse result, ApprovedCard approved, Judgment judgment) {
        ObjectNode response = json.valueToTree(result);
        ObjectNode input =
                json.createObjectNode()
                        .put("schema_version", JUDGMENT_VERSION)
                        .put("fixture", false);
        FIELDS.forEach(field -> input.set(field, response.get(field)));
        input.set(
                "statistics_points",
                json.valueToTree(points(judgment, result.question().placeId())));
        input.putArray("excluded_provisional");
        ArrayNode candidates = input.putArray("rebuttal_candidates");
        for (JsonNode item : approved.spec().path("rebuttals").path("items")) {
            if (item.path("text").asText().isBlank()) continue;
            ObjectNode candidate = candidates.addObject();
            if (!item.path("id").asText().isBlank()) candidate.put("id", item.path("id").asText());
            candidate.put("text", item.path("text").asText()).putNull("decided_by_rule");
        }
        ObjectNode request = json.createObjectNode();
        request.set("judgment", input);
        request.set("articles", response.get("articles"));
        request.set("card", approved.spec());
        return request;
    }

    /**
     * 판정에 쓴 연 값. 계열이 측정소면 place_id 는 측정소 ID. 규칙이 시군구 연 값(공통 측정소 첫해 · 끝해 평균)을 계산했으면 그 둘을 질문 지역 값으로
     * 더한다 — 모델은 계산하지 않고 이 값을 그대로 쓴다. 통계 근거가 없으면 비운다(계약: 근거 ID 필수).
     */
    static List<Map<String, Object>> points(Judgment judgment, String placeId) {
        if (judgment == null || judgment.statistics().isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> points = new ArrayList<>();
        new TreeMap<>(judgment.values().bySeries())
                .forEach(
                        (series, years) ->
                                years.forEach(
                                        (year, value) ->
                                                points.add(
                                                        point(
                                                                judgment,
                                                                series.equals(
                                                                                AnnualRollup
                                                                                        .PLACE_SERIES)
                                                                        ? placeId
                                                                        : series,
                                                                year,
                                                                value))));
        Map<String, Object> facts = judgment.facts();
        for (String end : List.of("first", "last")) {
            if (facts.get(end + "Mean") instanceof BigDecimal mean
                    && facts.get(end + "Year") instanceof Integer year) {
                points.add(point(judgment, placeId, year, mean));
            }
        }
        return points;
    }

    private static Map<String, Object> point(
            Judgment judgment, String placeId, int year, BigDecimal value) {
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("evidence_id", judgment.statistics().get(0));
        point.put("indicator_id", judgment.indicatorId());
        point.put("unit", judgment.unit());
        point.put("place_id", placeId);
        point.put("period_start", LocalDate.of(year, 1, 1));
        point.put("period_end", LocalDate.of(year + 1, 1, 1));
        point.put("value", value);
        point.put("missing_reason", null);
        point.put("is_provisional", false);
        return point;
    }

    /** 응답에 넣을 ③ · ⑤ 와 argument_phrasing 한 행. */
    public record Phrased(Text warrant, List<Rebuttal> rebuttals, PhrasingRow row) {}
}
