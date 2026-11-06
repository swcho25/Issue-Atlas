package com.c108.issueatlas.question.service;

import com.c108.issueatlas.card.repository.CardRepository;
import com.c108.issueatlas.card.repository.CardRepository.CardEvidenceRow;
import com.c108.issueatlas.card.service.CardEvidenceStatus;
import com.c108.issueatlas.card.service.CardEvidenceStatus.KindStatus;
import com.c108.issueatlas.card.service.CardEvidenceStatus.Linked;
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
import com.c108.issueatlas.question.dto.MyQuestionList;
import com.c108.issueatlas.question.dto.MyQuestionList.MyQuestion;
import com.c108.issueatlas.question.dto.MyQuestionList.MyRun;
import com.c108.issueatlas.question.dto.QuestionCreateRequest;
import com.c108.issueatlas.question.dto.QuestionCreateResponse;
import com.c108.issueatlas.question.repository.QuestionRepository;
import com.c108.issueatlas.question.repository.QuestionRepository.CardRow;
import com.c108.issueatlas.question.repository.QuestionRepository.EvidenceRef;
import com.c108.issueatlas.question.repository.QuestionRepository.MatchedResponse;
import com.c108.issueatlas.question.repository.QuestionRepository.MyRunRow;
import com.c108.issueatlas.question.repository.QuestionRepository.PreviousRun;
import com.c108.issueatlas.question.repository.QuestionRepository.StoredQuestion;
import com.c108.issueatlas.question.service.ArgumentPhraser.Phrased;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 질문 저장 → 실행 → 결과 저장(S15P31C108-133). 판단(claim · 비교 조건 · 근거 고르기)은 승인본 기반 {@link CardJudge}가 하고,
 * 여기서는 근거 수요표 · 실행 상태 · 한정어 · 6칸 문장(템플릿)을 만든다. 승인본이 있으면 ③ 보증 · ⑤ 반박만 {@link ArgumentPhraser}(engine
 * LLM 문장화)가 바꿔 쓸 수 있고, 못 받으면 템플릿 그대로다. 실행 결과는 한 번 쓰고 고치지 않는다.
 */
@Service
public class QuestionService {
    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);
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
    private final CardEvidenceStatus evidence;
    private final CardJudge judge;
    private final SeriesService series;
    private final ArgumentPhraser phraser;
    private final ObjectMapper json;
    private final TransactionTemplate tx;

    public QuestionService(
            QuestionRepository questions,
            CardRepository cards,
            CardEvidenceStatus evidence,
            CardJudge judge,
            SeriesService series,
            ArgumentPhraser phraser,
            ObjectMapper json,
            PlatformTransactionManager transactions) {
        this.questions = questions;
        this.cards = cards;
        this.evidence = evidence;
        this.judge = judge;
        this.series = series;
        this.phraser = phraser;
        this.json = json;
        this.tx = new TransactionTemplate(transactions);
    }

    /**
     * engine 문장화(최대 ENGINE_TIMEOUT)는 트랜잭션 밖에서 불러 그동안 DB 연결을 잡지 않는다(S15P31C108-254). ① 판정 · 결과 조립(짧은
     * 트랜잭션) → ② 문장화(트랜잭션 없음) → ③ 질문 · 실행 · 문장화 · 근거 행 저장(짧은 트랜잭션). 실행 결과는 ③에서 한 번만 쓴다. 이 메서드에
     * {@code @Transactional} 을 달면 ②가 다시 트랜잭션 안으로 들어간다.
     *
     * <p>asker 는 로그인한 사람의 이메일(질문의 묻는 사람), 로그인 없이 물었으면 null.
     */
    public QuestionCreateResponse create(QuestionCreateRequest request, String asker) {
        if (!request.periodStart().isBefore(request.periodEnd())) {
            throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
        }
        return execute(request, null, asker);
    }

    /** 내 질문을 같은 지역 · 카드 · 기간으로 다시 실행한다(같은 질문의 새 실행). 남의 질문 · 없는 질문은 404 */
    public QuestionCreateResponse rerun(String questionId, String asker) {
        StoredQuestion q =
                tx.execute(
                                status ->
                                        questions
                                                .userId(asker)
                                                .flatMap(
                                                        id ->
                                                                questions.ownQuestion(
                                                                        questionId, id)))
                        .orElseThrow(ResourceNotFoundException::new);
        return execute(
                new QuestionCreateRequest(
                        q.placeId(), q.cardId(), q.periodStart(), q.periodEnd(), q.rawText()),
                q.questionId(),
                asker);
    }

    /** 로그인한 사람이 물은 질문과 실행(회차). 마지막 실행이 새로운 질문부터 */
    @Transactional(readOnly = true)
    public MyQuestionList mine(String asker) {
        long userId = questions.userId(asker).orElseThrow(ResourceNotFoundException::new);
        Map<String, List<MyRun>> runs =
                questions.myRuns(userId).stream()
                        .collect(
                                Collectors.groupingBy(
                                        MyRunRow::questionId,
                                        LinkedHashMap::new,
                                        Collectors.mapping(
                                                r ->
                                                        new MyRun(
                                                                r.runId(),
                                                                r.runStatus(),
                                                                r.createdAt(),
                                                                r.claim(),
                                                                r.claimText()),
                                                Collectors.toList())));
        return new MyQuestionList(
                SCHEMA_VERSION,
                questions.myQuestions(userId).stream()
                        .map(
                                q ->
                                        new MyQuestion(
                                                q.questionId(),
                                                q.placeId(),
                                                q.placeName(),
                                                q.cardId(),
                                                q.cardName(),
                                                q.periodStart(),
                                                q.periodEnd(),
                                                q.rawText(),
                                                q.cardId() == null,
                                                q.createdAt(),
                                                runs.getOrDefault(q.questionId(), List.of())))
                        .toList());
    }

    /** questionId 가 있으면 그 질문의 새 실행, 없으면 새 질문과 첫 실행 */
    private QuestionCreateResponse execute(
            QuestionCreateRequest request, String questionId, String asker) {
        long started = System.nanoTime();
        Draft draft = Objects.requireNonNull(tx.execute(status -> draft(request, questionId)));
        Run run = draft.run();
        Phrased phrased =
                run.approved() == null
                        ? null
                        : phraser.phrase(draft.result(), run.approved(), run.judgment());
        ArgumentResponse result =
                phrased == null
                        ? draft.result()
                        : draft.result().withArgumentText(phrased.warrant(), phrased.rebuttals());
        tx.executeWithoutResult(
                status -> {
                    if (questionId == null) {
                        Long askedBy = asker == null ? null : questions.userId(asker).orElse(null);
                        questions.insertQuestion(
                                draft.questionId(),
                                request.placeId(),
                                request.cardId(),
                                request.periodStart(),
                                request.periodEnd(),
                                request.rawText(),
                                askedBy);
                    }
                    save(request, draft.questionId(), run, result, phrased, started);
                });
        return new QuestionCreateResponse(
                SCHEMA_VERSION,
                draft.questionId(),
                result.runId(),
                run.status(),
                request.cardId() == null);
    }

    /** ① 판정과 C2 결과 조립(카드 문구). 기존 대응 후보 → 근거만 쓰고, 질문 · 실행 행은 ③에서 쓴다. */
    private Draft draft(QuestionCreateRequest request, String existingQuestionId) {
        LocalDate start = request.periodStart();
        LocalDate end = request.periodEnd();
        String placeName =
                questions.placeName(request.placeId()).orElseThrow(ResourceNotFoundException::new);
        CardRow card =
                request.cardId() == null
                        ? null
                        : questions
                                .card(request.cardId())
                                .orElseThrow(ResourceNotFoundException::new);
        String questionId =
                existingQuestionId != null ? existingQuestionId : "q_" + UUID.randomUUID();
        String runId = "run_" + UUID.randomUUID();

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
                                        : ceilingItems(run.approved().spec()),
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
        return new Draft(questionId, run, result);
    }

    /**
     * ③ 실행 · 문장화 · 근거 행(새 질문이면 질문 행은 바로 앞에서 쓴다). result 는 문장화를 반영한 최종 응답, phrased 는 engine 을 안 불렀으면
     * null.
     */
    private void save(
            QuestionCreateRequest request,
            String questionId,
            Run run,
            ArgumentResponse result,
            Phrased phrased,
            long started) {
        LocalDate start = request.periodStart();
        LocalDate end = request.periodEnd();
        String runId = result.runId();
        PreviousRun previous =
                questions.previousRun(request.placeId(), request.cardId(), start, end).orElse(null);
        int filled = filledCells(result);
        int durationMs = (int) ((System.nanoTime() - started) / 1_000_000);
        questions.insertRun(
                runId,
                questionId,
                run.status(),
                result.cardVersion(),
                result.formulaVersion(),
                result.taxonomyVersion(),
                json.writeValueAsString(result),
                result.createdAt(),
                previous == null ? null : previous.runId(),
                filled,
                durationMs);
        log.info(
                "argument_run {} prev {} filled {}/6 ({}) edits - duration {}ms ({})",
                runId,
                previous == null ? "-" : previous.runId(),
                filled,
                diff(filled, previous == null ? null : previous.filledCells()),
                durationMs,
                diff(durationMs, previous == null ? null : previous.durationMs()));
        if (phrased != null) {
            questions.insertPhrasing(runId, phrased.row());
        }
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
    }

    /** 저장된 결과 그대로(JSON). 지난 실행을 다시 계산하지 않는다. */
    @Transactional(readOnly = true)
    public String argument(String runId) {
        return questions.result(runId).orElseThrow(ResourceNotFoundException::new);
    }

    /** 재실행 로그 「자동 채움」: 6칸 중 내용이 찬 칸. 판단은 근거 부족 · 비교 불가가 아닌 문장이 있을 때만 찬 것으로 본다. */
    static int filledCells(ArgumentResponse r) {
        Data d = r.data();
        boolean[] cells = {
            r.claim().text() != null
                    && !List.of("insufficient", "not_comparable").contains(r.claim().value()),
            !(d.statistics().isEmpty()
                    && d.documents().isEmpty()
                    && d.existingResponses().isEmpty()
                    && d.denominators().isEmpty()),
            r.warrant().text() != null && !r.warrant().text().isBlank(),
            r.qualifier().grade() != null,
            !r.rebuttals().isEmpty(),
            !r.ceiling().items().isEmpty()
        };
        int n = 0;
        for (boolean c : cells) {
            n += c ? 1 : 0;
        }
        return n;
    }

    private static String diff(int now, Integer before) {
        return before == null ? "-" : String.format("%+d", now - before);
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
        Map<String, CardEvidenceRow> registered =
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

        // 근거 상태 규칙은 카드 목록 ②와 같이 쓴다(CardEvidenceStatus) — 여기서는 근거 행을 만든 뒤 이은 수로 부른다
        KindStatus statisticsStatus =
                evidence.statistics(
                        registered, approved == null ? null : approved.spec(), placeId, start, end);
        boolean statistics = "available".equals(statisticsStatus.status());
        Judgment judgment =
                statistics && approved != null
                        ? judge.judge(approved, placeId, start, end).orElse(null)
                        : null;
        if (judgment != null) {
            refs.put("statistics", load(judgment.statistics()));
            refs.put("documents", load(judgment.documents()));
            refs.put("denominators", load(judgment.denominators()));
        }
        Map<String, KindStatus> status =
                CardEvidenceStatus.resolve(
                        registered,
                        statisticsStatus,
                        new Linked(
                                refs.get("existing_responses").size(),
                                pending.size(),
                                refs.get("documents").size(),
                                refs.get("denominators").size()));
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
            table.add(row(status.get(kind), refs.get(kind).size(), pending.size(), required));
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
        int minimumYears =
                approved.spec().path("applicability").path("min_complete_years").asInt(0);
        int completeYears = ((Number) judgment.facts().getOrDefault("yearCount", 0)).intValue();
        if (completeYears < minimumYears) {
            return notJudged(
                    "unsupported",
                    table,
                    "카드 적용 조건 미충족으로 검사하지 않음",
                    "완전한 연 값 " + minimumYears + "개 이상이 필요해 판단하지 않습니다.",
                    approved,
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
                pending,
                judgment);
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
                pending,
                null);
    }

    /** 판정이 고른 근거를 판정이 준 순서 그대로(문서는 등록일 순, 분모는 카드 설계도 순). 저장소는 ID 순으로 읽는다. */
    private List<EvidenceRef> load(List<String> ids) {
        List<EvidenceRef> found = questions.evidence(ids);
        if (found.size() != ids.size()) {
            throw new IllegalStateException("Card rule returned unknown evidence");
        }
        Map<String, EvidenceRef> byId =
                found.stream()
                        .collect(Collectors.toMap(EvidenceRef::evidenceId, Function.identity()));
        return ids.stream().map(byId::get).toList();
    }

    /**
     * 근거 수요표 한 줄. 상태 · 보류 수는 {@link CardEvidenceStatus#resolve}(카드 목록과 같은 규칙), count 는 이번 실행이 이은 근거
     * 수.
     */
    private static EvidenceRow row(KindStatus status, int count, int pending, boolean required) {
        String kind = status.kind();
        String reason =
                kind.equals("existing_responses") && (count > 0 || pending > 0)
                        ? pending == 0 ? null : "출처 등급이 정해지지 않은 후보 " + pending + "건은 근거로 쓰지 않았습니다."
                        : missingReason(kind, status.status());
        return new EvidenceRow(
                kind, required, status.status(), count, status.reviewPendingCount(), reason);
    }

    /** 근거 수요표의 「없는 이유」(회사 플랜 Goal ①). available 이면 null, 아니면 상태 · 근거 종류별 문장. */
    static String missingReason(String kind, String status) {
        return switch (status) {
            case "available" -> null;
            case "not_published" -> "원천이 이 기간 값을 아직 공표하지 않았습니다.";
            case "license_blocked" -> "이용 조건상 이 근거를 저장 · 표시할 수 없습니다.";
            case "review_pending" -> "검수를 기다리는 근거라 아직 쓰지 않았습니다.";
            default ->
                    switch (kind) {
                        case "statistics" -> "이 지역 · 기간의 통계 관측 값이 없습니다.";
                        // 광역 기관(광주광역시) 보도자료는 시군구 질문에 잇지 않는다(S15P31C108-253)
                        case "documents" -> "이 지역 · 기간 보도자료 가운데 카드 키워드에 맞는 글이 없습니다.";
                        case "existing_responses" -> "이 지역 · 기간 · 카드에 맞는 기존 대응 후보가 없습니다.";
                        case "denominators" -> "카드의 분모 지표에 이 지역 · 기간 관측 값이 없습니다.";
                        default -> "이 지역 · 기간의 근거가 없습니다.";
                    };
        };
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

    /**
     * 상한선 ⑥ = 카드 상한선 + 카드 설계도의 예상 빈칸(C5 expected_gaps)을 문장으로(S15P31C108-265). 인수 기준 ③
     * 「license_blocked · not_published 숨김 없이 표시」를 C2 v1(expected_gaps[] 칸) 전까지 이미 있는 칸으로 보인다.
     */
    static List<String> ceilingItems(JsonNode spec) {
        List<String> items = new ArrayList<>(strings(spec.path("ceiling")));
        for (JsonNode gap : spec.path("expected_gaps")) {
            String what = gap.path("what").asText();
            String status = gap.path("status").asText();
            String phrase =
                    switch (status) {
                        case "license_blocked" -> "이용 허락이 없어 쓰지 않는다";
                        case "not_published" -> "공표되지 않는다";
                        case "not_collected" -> "수집하지 않는다";
                        default -> null;
                    };
            if (!what.isBlank() && phrase != null) {
                items.add(what + ": " + phrase + " (" + status + ")");
            }
        }
        return items;
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

    /**
     * 한 실행의 중간 결과. responses: 기존 대응 근거 ID → 후보 ID, pending: 등급 없어 근거로 못 쓴 후보, judgment: 규칙이 판정했을 때만
     * (문장화 입력의 연 값).
     */
    private record Run(
            String status,
            List<EvidenceRow> table,
            Comparability comparability,
            Claim claim,
            Data data,
            ApprovedCard approved,
            Map<String, List<EvidenceRef>> refs,
            Map<String, String> responses,
            List<String> pending,
            Judgment judgment) {}

    /** ①의 결과: 아직 저장하지 않은 질문 ID · 실행 · 카드 문구 응답. */
    private record Draft(String questionId, Run run, ArgumentResponse result) {}
}
