package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.dto.QuestionCandidatePage;
import com.c108.issueatlas.question.dto.QuestionCandidatePage.QuestionCandidate;
import com.c108.issueatlas.question.dto.QuestionCandidatePage.QuestionCandidateAsker;
import com.c108.issueatlas.question.repository.QuestionCandidateRepository;
import com.c108.issueatlas.question.repository.QuestionCandidateRepository.CandidateRow;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;

/** 관리자 새 이슈 후보 목록(S15P31C108-345). 질문 · 실행을 고치지 않는다. */
@Service
public class QuestionCandidateService {
    static final String NAME = "이슈 이름:";
    static final String REASON = "궁금한 까닭:";

    private final QuestionCandidateRepository candidates;

    public QuestionCandidateService(QuestionCandidateRepository candidates) {
        this.candidates = candidates;
    }

    /** 목록과 전체 건수를 같은 스냅샷에서 읽는다 */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public QuestionCandidatePage list(String placeId, int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
        }
        if (placeId != null
                && (placeId.isBlank()
                        || placeId.length() > 200
                        || placeId.chars().anyMatch(Character::isISOControl))) {
            throw new ErrorResponseException(HttpStatus.BAD_REQUEST);
        }
        List<QuestionCandidate> items =
                candidates.page(placeId, page, size).stream()
                        .map(QuestionCandidateService::candidate)
                        .toList();
        return new QuestionCandidatePage(items, candidates.count(placeId), page, size);
    }

    private static QuestionCandidate candidate(CandidateRow r) {
        Parsed parsed = parse(r.rawText());
        return new QuestionCandidate(
                r.questionId(),
                r.placeId(),
                r.placeName(),
                r.periodStart(),
                r.periodEnd(),
                parsed.issueName(),
                parsed.reason(),
                parsed.sentence(),
                r.rawText(),
                r.askerId() == null
                        ? null
                        : new QuestionCandidateAsker(r.askerId(), r.askerName(), r.askerEmail()),
                r.createdAt());
    }

    /**
     * 새 질문 후보 창이 원문에 붙인 줄을 나눈다: 줄마다 앞뒤 공백을 지우고, 「이슈 이름:」 · 「궁금한 까닭:」 으로 시작하는 첫 줄이 그 칸(값이 비면 null),
     * 나머지 비지 않은 줄은 문장으로 잇는다.
     */
    static Parsed parse(String raw) {
        if (raw == null) {
            return new Parsed(null, null, null);
        }
        String name = null;
        String reason = null;
        boolean nameSeen = false;
        boolean reasonSeen = false;
        List<String> rest = new ArrayList<>();
        for (String line : raw.split("\\R")) {
            String t = line.strip();
            if (!nameSeen && t.startsWith(NAME)) {
                nameSeen = true;
                name = value(t.substring(NAME.length()));
            } else if (!reasonSeen && t.startsWith(REASON)) {
                reasonSeen = true;
                reason = value(t.substring(REASON.length()));
            } else if (!t.isEmpty()) {
                rest.add(t);
            }
        }
        return new Parsed(name, reason, rest.isEmpty() ? null : String.join("\n", rest));
    }

    private static String value(String text) {
        String v = text.strip();
        return v.isEmpty() ? null : v;
    }

    record Parsed(String issueName, String reason, String sentence) {}
}
