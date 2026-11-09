package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class EvidenceDisplayTest {
    @Test
    void sumKeepsIntegerWithCommaAndTrueMinus() {
        assertThat(EvidenceDisplay.number(new BigDecimal("-1935"), "sum")).isEqualTo("−1,935");
        assertThat(EvidenceDisplay.number(new BigDecimal("271696"), "end_of_period"))
                .isEqualTo("271,696");
    }

    @Test
    void meanHasOneDecimalRoundedHalfUp() {
        assertThat(EvidenceDisplay.number(new BigDecimal("11.25"), "mean")).isEqualTo("11.3");
        assertThat(EvidenceDisplay.number(new BigDecimal("13"), "mean")).isEqualTo("13.0");
    }

    @Test
    void ratioKeepsUpToTwoDecimals() {
        assertThat(EvidenceDisplay.number(new BigDecimal("23.456"), "end_of_period"))
                .isEqualTo("23.46");
    }
}
