package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.client.ArgumentEngineClient;
import com.c108.issueatlas.question.client.ArgumentEngineClient.Reply;
import com.c108.issueatlas.question.dto.ApprovedCard;
import com.c108.issueatlas.question.dto.ArgumentResponse;
import com.c108.issueatlas.question.dto.ArgumentResponse.Citation;
import com.c108.issueatlas.question.dto.ArgumentResponse.Rebuttal;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.PhrasingRow;
import com.c108.issueatlas.question.repository.QuestionRepository.RebuttalArticleRow;
import com.c108.issueatlas.question.repository.QuestionRepository.RebuttalQuery;
import com.c108.issueatlas.question.service.CardJudge.Judgment;
import com.c108.issueatlas.question.service.PhrasingCache.Lookup;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 논증 카드 ⑤ 반박 문장화(S15P31C108-231, contracts/ai v0.3 「문장화」). 규칙 판정이 끝난 응답을 판정 입력으로 바꿔 engine 에 보내고,
 * 결과가 done 일 때만 반박 칸을 바꿔 쓴다. ③ 보증은 카드 문장 그대로다(S15P31C108-282, Figma: AI 칩은 ⑤ 만). 판정 · 수치 · 다른 칸은
 * 건드리지 않는다. 못 받으면 빈 반박 + 사유 코드. 같은 입력의 done 결과는 {@link PhrasingCache} 로 다시 쓴다.
 *
 * <p>v0.5(S15P31C108-326): 그 판의 반박 검색 질의가 있으면 질문 지역 · 기간 기사와 반박별 코사인({@code rebuttal_search})을 함께
 * 보내 engine 이 반박마다 근거 기사를 고르게 하고, 고른 기록({@code retrieval})을 argument_phrasing 에 남긴다.
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
    private final QuestionRepository questions;
    private final ObjectMapper json;

    public ArgumentPhraser(
            ArgumentEngineClient engine,
            PhrasingCache cache,
            QuestionRepository questions,
            ObjectMapper json) {
        this.engine = engine;
        this.cache = cache;
        this.questions = questions;
        this.json = json;
    }

    /** judgment 는 규칙이 판정했을 때만 있다(연 값). 없으면 engine 이 RUN_* · NOT_JUDGED 로 건너뛴다. */
    public Phrased phrase(ArgumentResponse result, ApprovedCard approved, Judgment judgment) {
        long started = System.nanoTime();
        ObjectNode request = request(result, approved, judgment);
        Lookup lookup = cache.get(request, () -> engine.phrase(request), ArgumentPhraser::reusable);
        int durationMs = (int) ((System.nanoTime() - started) / 1_000_000);
        Phrased phrased = apply(result, lookup.reply(), durationMs, rebuttalIds(request));
        log.info(
                "argument_phrasing {} {} {} {}ms {}",
                result.runId(),
                phrased.row().status(),
                phrased.row().reasonCode() == null ? "-" : phrased.row().reasonCode(),
                durationMs,
                lookup.source().name().toLowerCase(Locale.ROOT));
        return phrased;
    }

    /** 다시 써도 되는 결과: done 이고 바꿔 쓸 반박 칸이 모양대로 있다. 실패 · 시간 초과 · 건너뜀은 다음 질문이 다시 부른다. */
    static boolean reusable(Reply reply) {
        JsonNode r = reply.result();
        return r != null
                && "done".equals(r.path("status").asText())
                && r.path("rebuttals").isArray();
    }

    private Phrased apply(ArgumentResponse result, Reply reply, int durationMs, List<String> ids) {
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
                            durationMs,
                            null);
            return new Phrased(result.rebuttals(), row);
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
                        durationMs,
                        r.path("retrieval").isObject() ? r.get("retrieval").toString() : null);
        if (!status.equals("done")) {
            return new Phrased(result.rebuttals(), row);
        }
        try {
            // engine 이 옛 판(결과 v0.2)이라 warrant 를 같이 보내도 쓰지 않는다
            List<Rebuttal> rebuttals =
                    List.of(json.treeToValue(r.get("rebuttals"), Rebuttal[].class));
            return new Phrased(cite(rebuttals, ids, r.path("citations")), row);
        } catch (JacksonException | IllegalArgumentException e) {
            return apply(result, new Reply(null, "ENGINE_ERROR"), durationMs, ids);
        }
    }

    /**
     * 요청의 경쟁 설명마다 engine 이 쓰는 반박 ID(AI 계약 「rebuttal_candidates」): 규칙이 정하지 않은 것만 카드 반박 ID, 없으면 R1 ….
     * 규칙이 정한 것은 null.
     */
    static List<String> rebuttalIds(JsonNode request) {
        List<String> ids = new ArrayList<>();
        int n = 0;
        for (JsonNode candidate : request.path("judgment").path("rebuttal_candidates")) {
            if (!candidate.path("decided_by_rule").isNull()) {
                ids.add(null);
                continue;
            }
            n++;
            String id = candidate.path("id").asText();
            ids.add(id.isBlank() ? "R" + n : id);
        }
        return ids;
    }

    /**
     * 「근거 있음」 반박에만 engine 인용(반박 ID → 인용문 · 원문 위치)을 붙인다(C2 선택 칸, S15P31C108-343). 기사 인용만, 같은 기사 같은
     * 인용문은 한 번. 반박 수가 경쟁 설명 수와 다르면 어느 반박의 인용인지 모르므로 붙이지 않는다. 제목 · 원문 링크 · evidenceId 는 실행을 저장할 때
     * 채운다.
     */
    static List<Rebuttal> cite(List<Rebuttal> rebuttals, List<String> ids, JsonNode citations) {
        if (rebuttals.size() != ids.size()) {
            return rebuttals;
        }
        List<Rebuttal> cited = new ArrayList<>();
        for (int i = 0; i < rebuttals.size(); i++) {
            Rebuttal rebuttal = rebuttals.get(i);
            Map<String, Citation> found = new LinkedHashMap<>();
            if ("supported".equals(rebuttal.status()) && ids.get(i) != null) {
                for (JsonNode c : citations.path(ids.get(i))) {
                    JsonNode at = c.path("locator");
                    String article = at.path("source_id").asText();
                    String quote = c.path("quote").asText();
                    if (!"article".equals(at.path("kind").asText())
                            || article.isBlank()
                            || quote.isBlank()) continue;
                    try {
                        found.putIfAbsent(
                                article + "|" + quote,
                                new Citation(
                                        article,
                                        LocalDate.parse(at.path("date").asText()),
                                        quote,
                                        null,
                                        null,
                                        null));
                    } catch (DateTimeParseException e) {
                        // 날짜를 못 읽는 인용은 보이지 않는다
                    }
                }
            }
            cited.add(
                    found.isEmpty()
                            ? rebuttal
                            : rebuttal.withCitations(List.copyOf(found.values())));
        }
        return cited;
    }

    /** contracts/ai phrasing-request: 판정 입력 + 그 실행의 articles[] + 카드 승인본 (+ 반박 검색 재료, v0.5). */
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
        List<String> asked = new ArrayList<>();
        for (JsonNode item : approved.spec().path("rebuttals").path("items")) {
            if (item.path("text").asText().isBlank()) continue;
            ObjectNode candidate = candidates.addObject();
            String id = item.path("id").asText();
            if (!id.isBlank()) candidate.put("id", id);
            asked.add(id.isBlank() ? null : id);
            candidate.put("text", item.path("text").asText()).putNull("decided_by_rule");
        }
        ObjectNode request = json.createObjectNode();
        request.set("judgment", input);
        request.set("articles", response.get("articles"));
        request.set("card", approved.spec());
        ObjectNode search = null;
        try {
            search = search(result.question(), approved, asked);
        } catch (DataAccessException e) {
            // 검색 재료는 덧붙이는 것이라, 못 읽으면 예전처럼 카드 태그 기사로 문장화한다
            log.warn("rebuttal_search {} {}", result.runId(), e.getClass().getSimpleName());
        }
        if (search != null) {
            request.set("rebuttal_search", search);
        }
        return request;
    }

    /**
     * ⑤ 반박별 근거 기사 재료(contracts/ai v0.5 「반박별 근거 기사」). 그 판의 활성 반박 질의가 물을 반박을 모두 덮을 때만 만들고, 하나라도
     * 없으면(질의를 아직 안 만듦 · 카드 판이 바뀜 · ID 없는 반박) null — engine 은 카드 태그 기사(articles)를 쓴다. 기사는 질문 지역 ·
     * 기간에서 활성 벡터가 있는 것 전부이고, 질의마다 코사인을 붙인다.
     */
    ObjectNode search(
            ArgumentResponse.Question question, ApprovedCard approved, List<String> asked) {
        if (asked.isEmpty() || asked.contains(null)) {
            return null;
        }
        Set<String> wanted = Set.copyOf(asked);
        Map<String, RebuttalQuery> queries = new HashMap<>();
        questions
                .rebuttalQueries(approved.cardId(), approved.version())
                .forEach(query -> queries.put(query.rebuttalId(), query));
        if (!queries.keySet().containsAll(wanted)
                || wanted.stream().map(id -> queries.get(id).queryVersion()).distinct().count()
                        != 1) {
            return null;
        }
        ObjectNode search =
                json.createObjectNode()
                        .put("query_version", queries.get(asked.get(0)).queryVersion());
        ArrayNode sent = search.putArray("queries");
        asked.stream()
                .distinct()
                .forEach(
                        id ->
                                sent.addObject()
                                        .put("id", id)
                                        .put("text", queries.get(id).queryText()));
        // 기사 하나에 질의마다 한 행 → 기사마다 cosine {반박 ID: 값}. 같은 기사가 두 번 와도 한 번만 보낸다
        Map<String, ObjectNode> articles = new LinkedHashMap<>();
        Map<String, ObjectNode> cosines = new HashMap<>();
        for (RebuttalArticleRow row :
                questions.rebuttalArticles(
                        approved.cardId(),
                        approved.version(),
                        question.placeId(),
                        question.periodStart(),
                        question.periodEnd())) {
            if (!wanted.contains(row.rebuttalId())) continue;
            if (!articles.containsKey(row.id())) {
                ObjectNode article =
                        json.createObjectNode().put("id", row.id()).put("date", row.date());
                article.put("summary", row.summary());
                articles.put(row.id(), article);
                cosines.put(row.id(), article.putObject("cosine"));
            }
            cosines.get(row.id()).put(row.rebuttalId(), row.cosine());
        }
        ArrayNode list = search.putArray("articles");
        articles.forEach(
                (id, article) -> {
                    if (cosines.get(id).size() == wanted.size()) list.add(article);
                });
        return search;
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

    /** 응답에 넣을 ⑤ 와 argument_phrasing 한 행. */
    public record Phrased(List<Rebuttal> rebuttals, PhrasingRow row) {}
}
