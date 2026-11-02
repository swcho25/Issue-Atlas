package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import java.time.LocalDate;
import java.util.List;

/**
 * 카드 판정 규칙(P5) 연결 지점. 카드마다 Spring 빈 하나를 둔다. 빈이 없는 카드는 판단하지 않는다(unsupported, 「판정 규칙이 아직 연결되지 않아」).
 * 규칙 값을 여기서 다시 계산하거나 지어내지 않는다.
 */
public interface CardRule {
    String cardId();

    /** 판정 규칙 판 (예: c1-net-migration-0.1). */
    String formulaVersion();

    /** 판정하는 주 지표(지표 사전 ID). 카드 확보 상태(card_evidence_status)가 없을 때 이 지표의 관측 행으로 필수 근거(통계) 상태를 정한다. */
    String indicatorId();

    /** 보증 ③ 문장(카드 정의). 없으면 null. */
    String warrant();

    /** 상한선 ⑥ — 이 카드가 말하지 않는 것(카드 정의). */
    List<String> ceiling();

    /** 필수 근거(통계)가 available 일 때만 부른다. 근거는 evidence 표의 ID 로 돌려준다. */
    Judgment judge(String placeId, LocalDate start, LocalDate end, int cardVersion);

    /**
     * claim 은 C2 claim enum, level 은 claim_level. indicator 는 판단 문장에 넣을 지표 이름(예: 청년(19–39세) 순이동),
     * label 은 카드 결과 이름(rule.outcomes[].label, 예: 청년 순유출 확대). increasing · decreasing 이면
     * comparability 4개가 모두 통과여야 한다.
     */
    record Judgment(
            String claim,
            String level,
            String indicator,
            String label,
            Comparability comparability,
            List<String> statistics,
            List<String> documents,
            List<String> denominators) {}
}
