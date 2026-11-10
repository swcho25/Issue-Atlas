package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 근거 수요표 「없는 이유」(S15P31C108-249): available 이 아닌 칸에는 늘 문장이 있다. */
class MissingReasonTest {
    @Test
    void availableHasNoReason() {
        assertThat(QuestionService.missingReason("denominators", "available")).isNull();
    }

    @Test
    void everyOtherStatusAndKindHasReason() {
        for (String kind :
                new String[] {"statistics", "documents", "existing_responses", "denominators"}) {
            for (String status :
                    new String[] {
                        "not_published", "not_collected", "license_blocked", "review_pending"
                    }) {
                assertThat(QuestionService.missingReason(kind, status)).isNotBlank();
            }
        }
    }

    @Test
    void reasonFollowsStatusThenKind() {
        assertThat(QuestionService.missingReason("statistics", "not_published"))
                .isEqualTo("원천이 이 기간 값을 아직 공표하지 않았습니다.");
        assertThat(QuestionService.missingReason("documents", "license_blocked"))
                .isEqualTo("이용 조건상 이 근거를 저장 · 표시할 수 없습니다.");
        assertThat(QuestionService.missingReason("existing_responses", "not_collected"))
                .isEqualTo("이 지역 · 기간 · 카드에 맞는 기존 대응 후보가 없습니다.");
        assertThat(QuestionService.missingReason("denominators", "not_collected"))
                .isEqualTo("카드의 분모 지표에 이 지역 · 기간 관측 값이 없습니다.");
    }
}
