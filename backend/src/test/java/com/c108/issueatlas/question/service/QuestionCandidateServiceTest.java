package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.question.service.QuestionCandidateService.Parsed;
import org.junit.jupiter.api.Test;

/** 새 이슈 후보 원문 나누기(contracts/question-candidates 「raw_text 를 나누는 규칙」) */
class QuestionCandidateServiceTest {

    @Test
    void 후보_창이_붙인_두_줄을_칸으로_나누고_나머지는_문장() {
        assertThat(
                        QuestionCandidateService.parse(
                                "2024년 여수 관광객 수는 어떻게 변했나\n이슈 이름: 관광객 수\n궁금한 까닭: 축제 뒤 방문객"))
                .isEqualTo(new Parsed("관광객 수", "축제 뒤 방문객", "2024년 여수 관광객 수는 어떻게 변했나"));
    }

    @Test
    void 줄이_없으면_null_이고_빈_값도_null() {
        assertThat(QuestionCandidateService.parse(null)).isEqualTo(new Parsed(null, null, null));
        assertThat(QuestionCandidateService.parse("여수 관광객"))
                .isEqualTo(new Parsed(null, null, "여수 관광객"));
        assertThat(QuestionCandidateService.parse("이슈 이름:   \n궁금한 까닭:"))
                .isEqualTo(new Parsed(null, null, null));
    }

    @Test
    void 공백과_CRLF를_지우고_같은_머리말의_두번째_줄은_문장에_남긴다() {
        assertThat(
                        QuestionCandidateService.parse(
                                "  첫 줄  \r\n\r\n  이슈 이름: 관광객 수 \r\n이슈 이름: 다른 이름\r\n둘째 줄"))
                .isEqualTo(new Parsed("관광객 수", null, "첫 줄\n이슈 이름: 다른 이름\n둘째 줄"));
    }
}
