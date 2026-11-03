package com.c108.issueatlas.card.service;

import com.c108.issueatlas.card.dto.CardApprovalDto.*;
import com.c108.issueatlas.card.dto.CardStorageDto.Approve;
import com.c108.issueatlas.card.dto.CardStorageDto.Version;
import com.c108.issueatlas.card.repository.CardApprovalRepository;
import com.c108.issueatlas.card.repository.CardStorageRepository;
import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;

@Service
@Transactional(readOnly = true)
public class CardApprovalService {
    private final CardApprovalRepository requests;
    private final CardStorageRepository cards;
    private final CardStorageService storage;

    public CardApprovalService(
            CardApprovalRepository requests,
            CardStorageRepository cards,
            CardStorageService storage) {
        this.requests = requests;
        this.cards = cards;
        this.storage = storage;
    }

    @Transactional
    public Request submit(String cardId, Submit input, String email) {
        lockCard(cardId);
        var actor = requests.activeActor(email).orElseThrow(() -> error(HttpStatus.FORBIDDEN));
        requests.activeApprover(input.approverId())
                .orElseThrow(() -> error(HttpStatus.BAD_REQUEST));
        var draft = storage.draft(cardId);
        if (draft.draftRevision() != input.expectedRevision()
                || requests.openId(cardId).isPresent()
                || requests.isApprovedDraft(cardId)) throw error(HttpStatus.CONFLICT);
        cards.lockIndicatorsForApproval();
        if (!storage.check(cardId).valid()) throw error(HttpStatus.BAD_REQUEST);
        storage.validateRule(draft.draftSpec());
        String id = "approval_" + UUID.randomUUID();
        requests.create(
                id,
                cardId,
                draft.draftRevision(),
                draft.draftSpec().toString(),
                requests.indicatorVersions(draft.draftSpec().toString()).toString(),
                actor.id(),
                input.approverId(),
                input.reason().strip());
        return get(id);
    }

    public Request get(String id) {
        return requests.find(id).orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Detail detail(String id) {
        var request = get(id);
        return new Detail(
                request,
                requests.snapshot(id, false),
                requests.snapshot(id, true),
                storage.draft(request.cardId()).currentVersion(),
                requests.decisions(id));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page list(
            String status, String card, Long approver, Long requester, int page, int size) {
        if ((status != null
                        && !Set.of("pending", "on_hold", "approved", "rejected").contains(status))
                || page < 1
                || size < 1
                || size > 100
                || (approver != null && approver < 1)
                || (requester != null && requester < 1)) throw error(HttpStatus.BAD_REQUEST);
        return requests.list(status, card, approver, requester, page, size);
    }

    @Transactional
    public Request decide(String id, Decide input, String email) {
        String cardId = requests.cardId(id).orElseThrow(ResourceNotFoundException::new);
        // 모든 처리 경로에서 card -> request -> user -> indicator 순서로 잠근다.
        lockCard(cardId);
        requests.lock(id);
        var actor = requests.activeActor(email).orElseThrow(() -> error(HttpStatus.FORBIDDEN));
        var request = get(id);
        if (actor.id() != request.approverId()) throw error(HttpStatus.FORBIDDEN);
        if (request.revision() != input.expectedRevision()
                || !Set.of("pending", "on_hold").contains(request.status())
                || ("hold".equals(input.decision()) && "on_hold".equals(request.status())))
            throw error(HttpStatus.CONFLICT);
        Integer version = null;
        if ("approve".equals(input.decision())) {
            var draft = storage.draft(cardId);
            cards.lockIndicatorsForApproval();
            if (draft.draftRevision() != request.draftRevision()
                    || !draft.draftSpec().equals(requests.snapshot(id, false))
                    || !requests.indicatorVersions(draft.draftSpec().toString())
                            .equals(requests.snapshot(id, true))) throw error(HttpStatus.CONFLICT);
            version =
                    storage.approve(
                                    cardId,
                                    new Approve(request.draftRevision(), input.reason()),
                                    email)
                            .version();
        }
        requests.decide(id, actor.id(), input.decision(), input.reason().strip(), version);
        return get(id);
    }

    /** 기존 HTTP 승인 경로도 열린 요청·지정 승인자 확인을 거친다. */
    @Transactional
    public Version approveCurrent(String cardId, Approve input, String email) {
        lockCard(cardId);
        String id = requests.openId(cardId).orElseThrow(() -> error(HttpStatus.CONFLICT));
        var request = get(id);
        if (request.draftRevision() != input.expectedRevision()) throw error(HttpStatus.CONFLICT);
        var result = decide(id, new Decide(request.revision(), "approve", input.reason()), email);
        return storage.version(cardId, result.approvedVersion());
    }

    private void lockCard(String id) {
        if (!cards.lockCardForApproval(id)) throw new ResourceNotFoundException();
    }

    private static ErrorResponseException error(HttpStatus status) {
        return new ErrorResponseException(status);
    }
}
