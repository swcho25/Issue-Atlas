package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** C1 결과 순서(contracts/cards/C1.json rule.outcomes): 위에서부터 처음 맞는 것. */
class C1NetMigrationRuleTest {
    private static String[] of(int... years) {
        List<BigDecimal> values = Arrays.stream(years).mapToObj(BigDecimal::valueOf).toList();
        return C1NetMigrationRule.outcome(values);
    }

    @Test
    void outcomesFollowCardOrder() {
        assertThat(of(-100, -200)).containsExactly("insufficient", "근거 부족");
        assertThat(of(-100, -200, -300)).containsExactly("increasing", "청년 순유출 확대");
        assertThat(of(-300, -200, -100)).containsExactly("decreasing", "청년 순유출 축소");
        assertThat(of(-300, -200, 50)).containsExactly("decreasing", "순유입 전환");
        assertThat(of(10, 20, 30)).containsExactly("decreasing", "순유입 전환");
        assertThat(of(-100, -300, -200)).containsExactly("unclear", "불분명");
        assertThat(of(-100, -100, -200)).containsExactly("unclear", "불분명");
    }
}
