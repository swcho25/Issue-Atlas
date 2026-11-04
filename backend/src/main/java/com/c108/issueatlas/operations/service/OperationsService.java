package com.c108.issueatlas.operations.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.operations.dto.OperationsDto.*;
import com.c108.issueatlas.operations.repository.OperationsRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.JsonNode;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class OperationsService {
    private static final Set<String> KINDS =
            Set.of("statistics", "documents", "existing_responses", "denominators");
    private static final Set<String> EVIDENCE_STATUSES =
            Set.of(
                    "available",
                    "not_published",
                    "not_collected",
                    "license_blocked",
                    "review_pending");
    private final OperationsRepository repository;

    public OperationsService(OperationsRepository repository) {
        this.repository = repository;
    }

    public Overview overview(OffsetDateTime from, OffsetDateTime to) {
        var generated = OffsetDateTime.now(ZoneOffset.UTC);
        var end = to == null ? generated : to;
        var start = from == null ? end.minusDays(7) : from;
        if (!start.isBefore(end)) bad();
        var period = new Period(start, end);
        return new Overview(
                generated,
                period,
                repository.queues(),
                repository.activity(period),
                repository.inventory(),
                repository.sources());
    }

    public Page runs(RunFilter filter, int page, int size) {
        if (page < 1 || size < 1 || size > 100) bad();
        checkText(filter.placeId());
        checkText(filter.cardId());
        if (filter.periodStart() != null
                && filter.periodEnd() != null
                && !filter.periodStart().isBefore(filter.periodEnd())) bad();
        return repository.runs(filter, page, size);
    }

    private void checkText(String value) {
        if (value != null
                && (value.isBlank()
                        || value.length() > 200
                        || value.chars().anyMatch(Character::isISOControl))) bad();
    }

    public Comparison compare(String beforeId, String afterId) {
        checkText(beforeId);
        checkText(afterId);
        if (beforeId == null || afterId == null || beforeId.equals(afterId)) bad();
        var before = snapshot(beforeId);
        var after = snapshot(afterId);
        Run b = before.run(), a = after.run();
        List<String> reasons = new ArrayList<>(), warnings = new ArrayList<>();
        if (!b.placeId().equals(a.placeId())) reasons.add("place_mismatch");
        if (b.cardId() == null || a.cardId() == null) reasons.add("card_not_selected");
        else if (!b.cardId().equals(a.cardId())) reasons.add("card_mismatch");
        if (!b.periodStart().equals(a.periodStart()) || !b.periodEnd().equals(a.periodEnd()))
            reasons.add("period_mismatch");
        if (a.createdAt().isBefore(b.createdAt())) reasons.add("run_order_invalid");
        if (b.runStatus().equals("unsupported") || a.runStatus().equals("unsupported"))
            reasons.add("unsupported_run");
        if (!Objects.equals(b.cardVersion(), a.cardVersion())) warnings.add("card_version_changed");
        if (!Objects.equals(b.formulaVersion(), a.formulaVersion()))
            warnings.add("formula_version_changed");
        if (!Objects.equals(b.taxonomyVersion(), a.taxonomyVersion()))
            warnings.add("taxonomy_version_changed");
        if (a.previousRunId() == null) warnings.add("previous_run_link_not_recorded");
        else if (!a.previousRunId().equals(b.runId())) warnings.add("non_consecutive_runs");
        if (b.cardVersion() == null || a.cardVersion() == null)
            warnings.add("card_version_not_recorded");
        var bm = before.metrics();
        var am = after.metrics();
        boolean policyChanged =
                !"evidence_policy_not_recorded"
                                .equals(bm.requiredEvidence().rate().unavailableReason())
                        && !"evidence_policy_not_recorded"
                                .equals(am.requiredEvidence().rate().unavailableReason())
                        && !bm.requiredEvidence()
                                .requiredKinds()
                                .equals(am.requiredEvidence().requiredKinds());
        if (policyChanged) warnings.add("required_evidence_policy_changed");
        boolean comparable = reasons.isEmpty();
        Delta filled = rateDelta(bm.filledCells(), am.filledCells(), comparable, null);
        Delta evidence =
                rateDelta(
                        bm.requiredEvidence().rate(),
                        am.requiredEvidence().rate(),
                        comparable,
                        policyChanged ? "required_evidence_policy_changed" : null);
        Delta edited;
        if (!comparable) edited = unavailable("count", "conditions_not_comparable");
        else if (bm.editedCells().value() == null || am.editedCells().value() == null)
            edited = unavailable("count", "edit_count_not_recorded");
        else
            edited =
                    new Delta(
                            BigDecimal.valueOf(
                                    (long) am.editedCells().value() - bm.editedCells().value()),
                            "count",
                            null);
        return new Comparison(
                comparable,
                reasons,
                warnings,
                before,
                after,
                new Deltas(filled, evidence, edited),
                new LinkedChanges(List.of(), "run_review_link_not_recorded"));
    }

    private Snapshot snapshot(String id) {
        Run run = repository.run(id).orElseThrow(ResourceNotFoundException::new);
        JsonNode result = repository.result(id);
        Rate filled =
                run.filledCells() == null
                        ? new Rate(null, 6, null, "filled_cells_not_recorded")
                        : rate(run.filledCells(), 6);
        Count edits =
                run.editCount() == null
                        ? new Count(null, "edit_count_not_recorded")
                        : new Count(run.editCount(), null);
        return new Snapshot(run, new Metrics(filled, coverage(result), edits), result);
    }

    private Coverage coverage(JsonNode result) {
        JsonNode table = result.path("evidence_table");
        if (!table.isArray() || table.isEmpty()) return missingCoverage();
        Set<String> seen = new HashSet<>(), required = new TreeSet<>();
        int available = 0;
        for (JsonNode row : table) {
            String kind = row.path("kind").asText("");
            if (!KINDS.contains(kind)
                    || !seen.add(kind)
                    || !row.path("required").isBoolean()
                    || !EVIDENCE_STATUSES.contains(row.path("status").asText("")))
                return missingCoverage();
            if (row.path("required").asBoolean()) {
                required.add(kind);
                if (row.path("status").asText().equals("available")) available++;
            }
        }
        if (required.isEmpty())
            return new Coverage(List.of(), new Rate(0, 0, null, "no_required_evidence"));
        return new Coverage(List.copyOf(required), rate(available, required.size()));
    }

    private Coverage missingCoverage() {
        return new Coverage(List.of(), new Rate(null, null, null, "evidence_policy_not_recorded"));
    }

    private Rate rate(int numerator, int denominator) {
        return new Rate(
                numerator,
                denominator,
                BigDecimal.valueOf(numerator * 100L)
                        .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP),
                null);
    }

    private Delta rateDelta(Rate before, Rate after, boolean comparable, String blocked) {
        if (!comparable) return unavailable("percentage_points", "conditions_not_comparable");
        if (blocked != null) return unavailable("percentage_points", blocked);
        if (before.percentage() == null || after.percentage() == null)
            return unavailable(
                    "percentage_points",
                    before.unavailableReason() != null
                            ? before.unavailableReason()
                            : after.unavailableReason());
        long numerator =
                (long) after.numerator() * before.denominator()
                        - (long) before.numerator() * after.denominator();
        long denominator = (long) after.denominator() * before.denominator();
        return new Delta(
                BigDecimal.valueOf(numerator * 100L)
                        .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP),
                "percentage_points",
                null);
    }

    private Delta unavailable(String unit, String reason) {
        return new Delta(null, unit, reason);
    }

    private void bad() {
        throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
    }
}
