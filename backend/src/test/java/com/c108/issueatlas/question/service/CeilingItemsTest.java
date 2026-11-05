package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/** 상한선 ⑥ = 카드 상한선 + 예상 빈칸 문장 (S15P31C108-265). */
class CeilingItemsTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void appendsExpectedGapsAfterCardCeiling() {
        var spec =
                json.readTree(
                        """
                        {"ceiling": ["발생원", "건강 영향"],
                         "expected_gaps": [
                           {"what": "기상 자료(강수 · 풍향)", "status": "not_collected"},
                           {"what": "확정자료 최근 2개월", "status": "not_published"},
                           {"what": "민원", "status": "license_blocked"}]}
                        """);
        assertThat(QuestionService.ceilingItems(spec))
                .containsExactly(
                        "발생원",
                        "건강 영향",
                        "기상 자료(강수 · 풍향): 수집하지 않는다 (not_collected)",
                        "확정자료 최근 2개월: 공표되지 않는다 (not_published)",
                        "민원: 이용 허락이 없어 쓰지 않는다 (license_blocked)");
    }

    @Test
    void cardWithoutGapsKeepsCeilingAndSkipsUnknownStatus() {
        var spec =
                json.readTree(
                        """
                        {"ceiling": ["떠난 이유"],
                         "expected_gaps": [{"what": "", "status": "not_published"},
                                           {"what": "무엇", "status": "available"}]}
                        """);
        assertThat(QuestionService.ceilingItems(spec)).containsExactly("떠난 이유");
        assertThat(QuestionService.ceilingItems(json.readTree("{}"))).isEmpty();
    }
}
