package com.c108.issueatlas.question.service;

import com.c108.issueatlas.card.repository.CardRepository;
import com.c108.issueatlas.card.repository.CardRepository.CardEvidenceRow;
import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.question.dto.ApprovedCard;
import com.c108.issueatlas.question.dto.ArgumentResponse;
import com.c108.issueatlas.question.dto.ArgumentResponse.Ceiling;
import com.c108.issueatlas.question.dto.ArgumentResponse.Claim;
import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import com.c108.issueatlas.question.dto.ArgumentResponse.Components;
import com.c108.issueatlas.question.dto.ArgumentResponse.Condition;
import com.c108.issueatlas.question.dto.ArgumentResponse.Data;
import com.c108.issueatlas.question.dto.ArgumentResponse.EvidenceRow;
import com.c108.issueatlas.question.dto.ArgumentResponse.Qualifier;
import com.c108.issueatlas.question.dto.ArgumentResponse.Question;
import com.c108.issueatlas.question.dto.ArgumentResponse.Ref;
import com.c108.issueatlas.question.dto.ArgumentResponse.Text;
import com.c108.issueatlas.question.dto.QuestionCreateRequest;
import com.c108.issueatlas.question.dto.QuestionCreateResponse;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.CardRow;
import com.c108.issueatlas.question.repository.QuestionRepository.EvidenceRef;
import com.c108.issueatlas.question.repository.QuestionRepository.MatchedResponse;
import com.c108.issueatlas.question.service.CardJudge.Judgment;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 질문 저장 → 실행 → 결과 저장(S15P31C108-133). 판단(claim · 비교 조건 · 근거 고르기)은 승인본 기반 {@link CardJudge}가 하고,
 * 여기서는 근거 수요표 · 실행 상태 · 한정어 · 6칸 문장(템플릿, LLM 없음)만 만든다. 실행 결과는 한 번 쓰고 고치지 않는다.
 */
@Service
public class QuestionService {
    static final String SCHEMA_VERSION = "c2-0.1";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final List<String> KINDS =
            List.of("statistics", "documents", "existing_responses", "denominators");
    private static final Map<String, String> CONDITIONS =
            Map.of(
                    "same_indicator", "같은 지표",
                    "same_period_length", "같은 기간 길이",
                    "same_boundary", "같은 경계",
                    "same_method", "같은 측정 방법");

    private final QuestionRepository questions;
    private final CardRepository cards;
    private final CardJudge judge;
    private final SeriesService series;
    private final ObjectMapper json;

    public QuestionService(
            QuestionRepository questions,
            CardRepository cards,
            CardJudge judge,
            SeriesService series,
            ObjectMapper json) {
        this.questions = questions;
        this.cards = cards;
        this.judge = judge;
        this.series = series;
        this.json = json;
    }

    @Transactional
    public QuestionCreateResponse create(QuestionCreateRequest request) {
        LocalDate start = request.periodStart();
        LocalDate end = request.periodEnd();
        if (!start.isBefore(end)) {
            throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
        }
        String placeName =
                questions.placeName(request.placeId()).orElseThrow(ResourceNotFoundException::new);
        CardRow card =
                request.cardId() == null
                        ? null
                        : questions
                                .card(request.cardId())
                                .orElseThrow(ResourceNotFoundException::new);
        String questionId = "q_" + UUID.randomUUID();
        String runId = "run_" + UUID.randomUUID();
        questions.insertQuestion(
                questionId, request.placeId(), request.cardId(), start, end, request.rawText());

        Question question =
                new Question(
                        questionId,
                        request.placeId(),
                        placeName,
                        card == null ? null : card.cardId(),
                        card == null ? null : card.name(),
                        start,
                        end);
        Run run = card == null ? candidate(question) : judge(question, card);
        ArgumentResponse result =
                new ArgumentResponse(
                        SCHEMA_VERSION,
                        runId,
                        question,
                        card == null ? null : card.cardVersion(),
                        run.approved() == null
                                ? null
                                : run.approved()
                                        .spec()
                                        .path("rule")
                                        .path("formula_version")
                                        .asText(),
                        card == null ? questions.taxonomyVersion() : card.taxonomyVersion(),
                        run.status(),
                        OffsetDateTime.now(KST),
                        run.table(),
                        run.comparability(),
                        run.claim(),
                        run.data(),
                        new Text(
                                run.approved() == null
                                        ? null
                                        : run.approved()
                                                .spec()
                                                .path("warrant")
                                                .path("text")
                                                .asText(),
                                "card"),
                        qualifier(run.refs(), end),
                        List.of(),
                        new Ceiling(
                                run.approved() == null
                                        ? List.of()
                                        : strings(run.approved().spec().path("ceiling")),
                                "card"),
                        // 판정과 따로, 카드가 있으면 그림 자료를 늘 보낸다(규칙이 없어도 화면은 그린다)
                        card == null
                                ? List.of()
                                : series.series(
                                        card.cardId(),
                                        run.approved() == null
                                                ? null
                                                : indicators(run.approved().spec()),
                                        request.placeId(),
                                        placeName,
                                        start,
                                        end),
                        card == null
                                ? List.of()
                                : series.articles(card.cardId(), request.placeId(), start, end));
        questions.insertRun(
                runId,
                questionId,
                run.status(),
                result.cardVersion(),
                result.formulaVersion(),
                result.taxonomyVersion(),
                json.writeValueAsString(result),
                result.createdAt());
        run.refs()
                .forEach(
                        (kind, refs) ->
                                refs.forEach(
                                        ref ->
                                                questions.insertSource(
                                                        runId,
                                                        kind,
                                                        ref.evidenceId(),
                                                        run.responses().get(ref.evidenceId()))));
        run.pending().forEach(id -> questions.insertSource(runId, "existing_responses", null, id));
        return new QuestionCreateResponse(
                SCHEMA_VERSION, questionId, runId, run.status(), card == null);
    }

    /** 저장된 결과 그대로(JSON). 지난 실행을 다시 계산하지 않는다. */
    @Transactional(readOnly = true)
    public String argument(String runId) {
        return questions.result(runId).orElseThrow(ResourceNotFoundException::new);
    }

    private Run candidate(Question question) {
        String reason = "카드가 없어 근거를 정하지 않았습니다.";
        List<EvidenceRow> table =
                KINDS.stream()
                        .map(
                                kind ->
                                        new EvidenceRow(
                                                kind,
                                                kind.equals("statistics"),
                                                "not_collected",
                                                0,
                                                0,
                                                reason))
                        .toList();
        return notJudged(
                "unsupported",
                table,
                "판단하지 않아 검사하지 않음",
                "목록에 없는 질문이라 신규 카드 후보로 저장했습니다. 판단하지 않습니다.",
                null,
                emptyRefs(),
                Map.of(),
                List.of());
    }

    private Run judge(Question question, CardRow card) {
        String placeId = question.placeId();
        LocalDate start = question.periodStart();
        LocalDate end = question.periodEnd();
        ApprovedCard approved =
                questions.approvedCard(card.cardId(), card.cardVersion()).orElse(null);
        Map<String, CardEvidenceRow> status =
                cards.findCards(placeId, start, end).stream()
                        .filter(
                                r ->
                                        r.cardId().equals(card.cardId())
                                                && r.cardVersion() == card.cardVersion())
                        .collect(
                                Collectors.toMap(
                                        CardEvidenceRow::kind,
                                        Function.identity(),
                                        (a, b) -> a,
                                        HashMap::new));

        // -136 기존 대응 후보 → 근거. 출처 등급이 없는 후보는 근거로 쓰지 않고 보류로 센다
        questions.createResponseEvidence(card.cardId(), placeId, start, end);
        List<MatchedResponse> matched =
                questions.matchedResponses(card.cardId(), placeId, start, end);
        Map<String, String> responses = new HashMap<>();
        List<String> pending = new ArrayList<>();
        for (MatchedResponse m : matched) {
            if (m.evidenceId() == null) {
                pending.add(m.responseId());
            } else {
                responses.put(m.evidenceId(), m.responseId());
            }
        }
        Map<String, List<EvidenceRef>> refs = emptyRefs();
        refs.put(
                "existing_responses",
                questions.evidence(responses.keySet().stream().sorted().toList()));

        if (approved != null && "not_collected".equals(statusOf(status, "statistics"))) {
            // ponytail: 카드 확보 상태를 쓰는 곳(P3/P4)이 아직 없어 실행 때 규칙 주 지표의 관측 행으로 정한다.
            // 등록된 available · not_published 는 그 값이 먼저다(등록 없음 = not_collected)
            String observed =
                    questions.statisticsStatus(
                            approved.spec().path("rule").path("indicator_id").asText(),
                            placeId,
                            start,
                            end);
            status.put(
                    "statistics",
                    new CardEvidenceRow(
                            card.cardId(),
                            card.name(),
                            null,
                            null,
                            card.cardVersion(),
                            card.taxonomyVersion(),
                            "statistics",
                            observed,
                            0));
        }
        boolean statistics = "available".equals(statusOf(status, "statistics"));
        Judgment judgment =
                statistics && approved != null
                        ? judge.judge(approved, placeId, start, end).orElse(null)
                        : null;
        if (judgment != null) {
            refs.put("statistics", load(judgment.statistics()));
            refs.put("documents", load(judgment.documents()));
            refs.put("denominators", load(judgment.denominators()));
        }
        List<EvidenceRow> table = new ArrayList<>();
        for (String kind : KINDS) {
            boolean required =
                    approved == null
                            ? kind.equals("statistics")
                            : "required"
                                    .equals(
                                            approved.spec()
                                                    .path("required_for_claim")
                                                    .path(kind)
                                                    .asText());
            table.add(row(kind, status.get(kind), refs.get(kind).size(), pending.size(), required));
        }
        if (approved == null) {
            return notJudged(
                    "unsupported",
                    table,
                    "판단하지 않아 검사하지 않음",
                    "이 카드의 판정 규칙이 아직 연결되지 않아 판단하지 않습니다.",
                    null,
                    refs,
                    responses,
                    pending);
        }
        boolean missingRequired =
                table.stream()
                        .anyMatch(
                                item ->
                                        item.required()
                                                && (!"available".equals(item.status())
                                                        || item.count() == 0));
        if (!statistics || missingRequired) {
            return notJudged(
                    "blocked",
                    table,
                    "필수 근거가 없어 검사하지 않음",
                    !statistics ? "필수 근거(통계)가 없어 판단하지 않습니다." : "필수 근거가 없어 판단하지 않습니다.",
                    approved,
                    refs,
                    responses,
                    pending);
        }
        if (judgment == null) {
            return notJudged(
                    "unsupported",
                    table,
                    "판단하지 않아 검사하지 않음",
                    "이 카드의 판정 규칙이 아직 연결되지 않아 판단하지 않습니다.",
                    null,
                    refs,
                    responses,
                    pending);
        }
        Comparability c = judgment.comparability();
        List<String> failed =
                failed(c).stream().map(CONDITIONS::get).filter(Objects::nonNull).toList();
        if (List.of("increasing", "decreasing").contains(judgment.claim()) && !failed.isEmpty()) {
            // C2: 비교 조건 하나라도 통과 못 하면 증가 · 감소를 낼 수 없다. 규칙 결과를 고쳐 쓰지 않는다
            throw new IllegalStateException("Card rule returned a trend without comparability");
        }
        boolean optionalMissing =
                table.stream().anyMatch(r -> !r.required() && !r.status().equals("available"));
        String text = claimText(judgment, question, approved);
        return new Run(
                optionalMissing ? "partial" : "ready",
                table,
                c,
                new Claim(judgment.claim(), judgment.level(), text, "rule"),
                data(refs),
                approved,
                refs,
                responses,
                pending);
    }

    private Run notJudged(
            String status,
            List<EvidenceRow> table,
            String note,
            String text,
            ApprovedCard approved,
            Map<String, List<EvidenceRef>> refs,
            Map<String, String> responses,
            List<String> pending) {
        Condition none = new Condition(null, note);
        return new Run(
                status,
                table,
                new Comparability(none, none, none, none),
                new Claim("insufficient", "insufficient_evidence", text, "rule"),
                data(refs),
                approved,
                refs,
                responses,
                pending);
    }

    private List<EvidenceRef> load(List<String> ids) {
        List<EvidenceRef> found = questions.evidence(ids);
        if (found.size() != ids.size()) {
            throw new IllegalStateException("Card rule returned unknown evidence");
        }
        return found;
    }

    private static String statusOf(Map<String, CardEvidenceRow> status, String kind) {
        CardEvidenceRow row = status.get(kind);
        return row == null ? "not_collected" : row.status();
    }

    /** 근거 수요표 한 줄. 상태는 P3/P4 가 확정한 card_evidence_status, 기존 대응은 이번 실행이 이은 후보로 정한다. */
    private static EvidenceRow row(
            String kind, CardEvidenceRow status, int count, int pending, boolean required) {
        int review = status == null ? 0 : status.reviewPendingCount();
        if (kind.equals("existing_responses") && (count > 0 || pending > 0)) {
            String reason =
                    pending == 0 ? null : "출처 등급이 정해지지 않은 후보 " + pending + "건은 근거로 쓰지 않았습니다.";
            return new EvidenceRow(
                    kind,
                    required,
                    count > 0 ? "available" : "review_pending",
                    count,
                    pending,
                    reason);
        }
        if (status == null) {
            String reason =
                    kind.equals("existing_responses")
                            ? "이 지역 · 기간 · 카드에 맞는 기존 대응 후보가 없습니다."
                            : "이 지역 · 기간의 확보 상태가 등록되지 않았습니다.";
            return new EvidenceRow(kind, required, "not_collected", count, 0, reason);
        }
        return new EvidenceRow(kind, required, status.status(), count, review, null);
    }

    private static List<String> failed(Comparability c) {
        Map<String, Condition> all = new LinkedHashMap<>();
        all.put("same_indicator", c.sameIndicator());
        all.put("same_period_length", c.samePeriodLength());
        all.put("same_boundary", c.sameBoundary());
        all.put("same_method", c.sameMethod());
        return all.entrySet().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getValue().passed()))
                .map(Map.Entry::getKey)
                .toList();
    }

    /** 판단 ①은 승인된 카드 문장과 규칙 결과 이름으로 만든다. */
    static String claimText(Judgment judgment, Question question, ApprovedCard approved) {
        String result =
                approved.spec()
                        .path("claim_template")
                        .asText()
                        .replace("{지역}", question.placeName())
                        .replace("{기간}", period(question.periodStart(), question.periodEnd()))
                        .replace("{판정값}", judgment.label())
                        .replace(
                                "{n}",
                                String.valueOf(
                                        judgment.facts().getOrDefault("commonStationCount", 0)));
        return result.endsWith(".") ? result : result + ".";
    }

    /** [start, end) 를 끝을 빼고 적는다: 연 단위 「2023–2025」, 그 밖 「2024-03-01~2024-06-30」. */
    static String period(LocalDate start, LocalDate end) {
        LocalDate last = end.minusDays(1);
        if (start.getDayOfYear() == 1 && end.getDayOfYear() == 1) {
            return start.getYear() == last.getYear()
                    ? start.getYear() + "년"
                    : start.getYear() + "–" + last.getYear();
        }
        return start + "~" + last;
    }

    /**
     * 한정어 ④ qualifier-0.1. 구성 값을 세는 방법은 C2 README 「정하지 않은 것」의 임시 방식을 따른다: 분모(denominators)는 빼고, 출처는
     * source_id, 독립 근거는 근거 그룹마다 1건, 1년은 분석 기간 끝 전 1년.
     */
    static Qualifier qualifier(Map<String, List<EvidenceRef>> refs, LocalDate end) {
        List<EvidenceRef> counted =
                refs.entrySet().stream()
                        .filter(e -> !e.getKey().equals("denominators"))
                        .flatMap(e -> e.getValue().stream())
                        .toList();
        int a = sources(counted, "A");
        int ab = sources(counted, "AB");
        int independent =
                (int)
                        refs.entrySet().stream()
                                .filter(e -> !e.getKey().equals("denominators"))
                                .filter(e -> !e.getValue().isEmpty())
                                .count();
        OffsetDateTime latest =
                counted.stream()
                        .map(EvidenceRef::observedAt)
                        .filter(Objects::nonNull)
                        .max(OffsetDateTime::compareTo)
                        .orElse(null);
        boolean recent =
                latest != null
                        && !latest.isBefore(end.minusYears(1).atStartOfDay(KST).toOffsetDateTime());
        String grade =
                a >= 2 && independent >= 3 && recent
                        ? "high"
                        : ab >= 1 && independent >= 2 ? "medium" : "low";
        return new Qualifier(
                grade, new Components(a, ab, independent, latest, recent), "qualifier-0.1", "rule");
    }

    private static int sources(List<EvidenceRef> refs, String grades) {
        return (int)
                refs.stream()
                        .filter(r -> grades.contains(r.sourceGrade()))
                        .map(EvidenceRef::sourceId)
                        .distinct()
                        .count();
    }

    private static Map<String, List<EvidenceRef>> emptyRefs() {
        Map<String, List<EvidenceRef>> refs = new LinkedHashMap<>();
        KINDS.forEach(kind -> refs.put(kind, List.of()));
        return refs;
    }

    private static List<String> strings(JsonNode array) {
        if (!array.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        array.forEach(item -> result.add(item.asText()));
        return result;
    }

    private static List<String> indicators(JsonNode spec) {
        List<String> result = new ArrayList<>();
        for (JsonNode item : spec.path("claim_items")) {
            result.add(item.path("indicator_id").asText());
        }
        return result;
    }

    private static Data data(Map<String, List<EvidenceRef>> refs) {
        Function<String, List<Ref>> to =
                kind ->
                        refs.get(kind).stream()
                                .map(
                                        r ->
                                                new Ref(
                                                        r.evidenceId(),
                                                        r.title(),
                                                        r.sourceName(),
                                                        r.sourceGrade(),
                                                        r.periodStart(),
                                                        r.periodEnd(),
                                                        r.storageScope()))
                                .toList();
        return new Data(
                to.apply("statistics"),
                to.apply("documents"),
                to.apply("existing_responses"),
                to.apply("denominators"),
                "rule");
    }

    /** 한 실행의 중간 결과. responses: 기존 대응 근거 ID → 후보 ID, pending: 등급 없어 근거로 못 쓴 후보. */
    private record Run(
            String status,
            List<EvidenceRow> table,
            Comparability comparability,
            Claim claim,
            Data data,
            ApprovedCard approved,
            Map<String, List<EvidenceRef>> refs,
            Map<String, String> responses,
            List<String> pending) {}
}
