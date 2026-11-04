package com.c108.issueatlas.review.service;

import com.c108.issueatlas.card.dto.CardApprovalDto;
import com.c108.issueatlas.card.dto.CardStorageDto;
import com.c108.issueatlas.card.service.CardApprovalService;
import com.c108.issueatlas.card.service.CardStorageService;
import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.review.dto.ReviewDto.*;
import com.c108.issueatlas.review.repository.ReviewRepository;
import com.c108.issueatlas.review.repository.ReviewRepository.ChangeFilter;
import com.c108.issueatlas.review.repository.ReviewRepository.Filter;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;
import tools.jackson.databind.JsonNode;

@Service
@Transactional(readOnly = true)
public class ReviewService {
    private static final Set<String> TYPES =
            Set.of("news_event", "normalized_record", "source", "card");
    private static final Set<String> ISSUES =
            Set.of(
                    "location",
                    "classification",
                    "duplicate",
                    "value",
                    "wording",
                    "metadata",
                    "other");
    private static final Set<String> STATES =
            Set.of("pending", "on_hold", "resolved", "rejected", "approval_pending");
    private final ReviewRepository reviews;
    private final CardStorageService cards;
    private final CardApprovalService approvals;

    public ReviewService(
            ReviewRepository reviews, CardStorageService cards, CardApprovalService approvals) {
        this.reviews = reviews;
        this.cards = cards;
        this.approvals = approvals;
    }

    @Transactional
    public Request submit(Submit in, String email, boolean admin) {
        JsonNode current = target(in.targetType(), in.targetId(), false);
        if (in.proposedValue() != null
                && !in.proposedValue().isNull()
                && (!in.proposedValue().isObject()
                        || in.proposedValue().toString().getBytes(StandardCharsets.UTF_8).length
                                > 65536)) bad();
        if (in.proposedValue() != null && !in.proposedValue().isNull())
            patchKeys(in.targetType(), in.proposedValue());
        if (in.targetType().equals("card")
                && in.cardId() != null
                && !in.cardId().equals(in.targetId())) bad();
        String card = in.targetType().equals("card") ? in.targetId() : in.cardId();
        if (card != null && !reviews.exists("card", "card_id", card))
            throw new ResourceNotFoundException();
        long actor = reviews.actor(email, admin).orElseThrow(() -> error(HttpStatus.FORBIDDEN));
        String id = "review_" + UUID.randomUUID();
        reviews.create(id, in, admin ? "admin" : "user", card, actor, current);
        return get(id);
    }

    public Request get(String id) {
        return reviews.find(id, false).orElseThrow(ResourceNotFoundException::new);
    }

    private JsonNode target(String type, String id, boolean lock) {
        if (!TYPES.contains(type)) bad();
        if (type.equals("normalized_record")) {
            try {
                if (!id.matches("[1-9][0-9]{0,18}") || Long.parseLong(id) < 1) bad();
            } catch (NumberFormatException ex) {
                bad();
            }
        }
        return reviews.target(type, id, lock).orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Detail detail(String id) {
        Request r = get(id);
        return new Detail(
                r,
                target(r.targetType(), r.targetId(), false),
                fields(r.targetType()),
                r.approvalRequestId() == null
                                && r.targetType().equals("card")
                                && Set.of("pending", "on_hold").contains(r.status())
                        ? fields("card")
                        : List.of(),
                scope(r.targetType()),
                reviews.approvalStatus(r.approvalRequestId()),
                r.approvalRequestId() != null || !Set.of("pending", "on_hold").contains(r.status())
                        ? List.of()
                        : r.targetType().equals("card")
                                ? List.of("confirm", "correct", "hold", "reject")
                                : List.of("confirm", "hold", "reject"),
                reviews.decisions(id));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page<Request> list(Filter f, int page, int size) {
        pagination(page, size);
        if (!allowed(f.status(), STATES)
                || !allowed(f.type(), TYPES)
                || !allowed(f.issue(), ISSUES)
                || !allowed(f.origin(), Set.of("user", "admin", "local_import", "model"))
                || (f.query() != null && f.query().length() > 200)) bad();
        return reviews.list(f, page, size);
    }

    @Transactional
    public Request decide(String id, Decide in, String email) {
        Request initial = get(id);
        // 카드 승인과 같은 순서: 대상 → 검수 요청 → 처리자. 다른 검수와 충돌해도 현재 값을 다시 비교한다.
        JsonNode before = target(initial.targetType(), initial.targetId(), true);
        Request r = reviews.find(id, true).orElseThrow(ResourceNotFoundException::new);
        long actor = reviews.actor(email, true).orElseThrow(() -> error(HttpStatus.FORBIDDEN));
        if (r.approvalRequestId() != null
                || r.revision() != in.expectedRevision()
                || !Set.of("pending", "on_hold").contains(r.status())
                || (r.status().equals("on_hold") && in.action().equals("hold"))) conflict();
        if (!in.scope().equals(scope(r.targetType()))) bad();
        boolean change = in.action().equals("correct");
        if (!change && ((in.after() != null && !in.after().isNull()) || in.approverId() != null))
            bad();
        if ((change || in.action().equals("confirm"))
                && (in.expectedValue() == null || !before.equals(in.expectedValue()))) conflict();
        String approval = null;
        if (change) {
            if (in.after() == null || !in.after().isObject() || in.after().isEmpty()) bad();
            patchKeys(r.targetType(), in.after());
            if (r.targetType().equals("card")) {
                if (in.approverId() == null || !in.after().path("draft_spec").isObject()) bad();
                var draft =
                        cards.saveDraft(
                                r.targetId(),
                                new CardStorageDto.SaveDraft(
                                        before.path("draft_revision").longValue(),
                                        in.after().path("draft_spec")),
                                email);
                approval =
                        approvals
                                .submit(
                                        r.targetId(),
                                        new CardApprovalDto.Submit(
                                                draft.draftRevision(),
                                                in.approverId(),
                                                in.reason()),
                                        email)
                                .requestId();
            } else {
                // 데이터 담당자와 반영 계약을 맞추기 전에는 기존 자료를 변경하지 않는다.
                conflict();
            }
        }
        JsonNode after = change ? target(r.targetType(), r.targetId(), false) : before;
        String status =
                switch (in.action()) {
                    case "hold" -> "on_hold";
                    case "reject" -> "rejected";
                    default -> approval == null ? "resolved" : "approval_pending";
                };
        reviews.finish(id, status, approval);
        reviews.audit("review_change:" + UUID.randomUUID(), r, in, actor, before, after);
        return get(id);
    }

    private static List<String> fields(String type) {
        return switch (type) {
            case "news_event" ->
                    List.of(
                            "summary",
                            "place_id",
                            "place_name",
                            "address",
                            "longitude",
                            "latitude",
                            "location_precision",
                            "card_ids");
            case "normalized_record" ->
                    List.of(
                            "value",
                            "unit",
                            "indicator_id",
                            "place_code_system",
                            "place_code_raw",
                            "title",
                            "category",
                            "department");
            case "source" ->
                    List.of(
                            "name",
                            "org",
                            "license_type",
                            "storage_scope",
                            "reliability_grade",
                            "robots_status");
            default -> List.of("draft_spec");
        };
    }

    private static void patchKeys(String type, JsonNode patch) {
        if (!patch.isObject()
                || patch.properties().stream().anyMatch(e -> !fields(type).contains(e.getKey())))
            bad();
    }

    private static String scope(String type) {
        return switch (type) {
            case "source" -> "source";
            case "card" -> "card";
            default -> "record";
        };
    }

    private static boolean allowed(String value, Set<String> values) {
        return value == null || values.contains(value);
    }

    private static void pagination(int page, int size) {
        if (page < 1 || size < 1 || size > 100) bad();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page<Change> changes(ChangeFilter f, int page, int size) {
        pagination(page, size);
        if (!allowed(f.type(), TYPES)
                || !allowed(f.scope(), Set.of("record", "source", "card"))
                || !allowed(f.action(), Set.of("confirm", "correct", "hold", "reject", "approve"))
                || (f.actor() != null && f.actor() < 1)
                || (f.from() != null && f.to() != null && !f.from().isBefore(f.to()))) bad();
        return reviews.changes(f, page, size);
    }

    public Change change(String id) {
        return reviews.change(id).orElseThrow(ResourceNotFoundException::new);
    }

    private static void bad() {
        throw error(HttpStatus.BAD_REQUEST);
    }

    private static void conflict() {
        throw error(HttpStatus.CONFLICT);
    }

    private static ErrorResponseException error(HttpStatus code) {
        return new ErrorResponseException(code);
    }
}
