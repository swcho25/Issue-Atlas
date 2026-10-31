package com.c108.issueatlas.question;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.question.dto.ArgumentResponse.Comparability;
import com.c108.issueatlas.question.dto.ArgumentResponse.Condition;
import com.c108.issueatlas.question.service.CardRule;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * 질문 저장 → 실행 → 결과 조회(S15P31C108-133). Flyway 실제 적용 + 보안 + SQL + C2 스키마. 각 테스트 자료는 롤백한다.
 *
 * <p>판정 규칙(P5)은 아직 저장소에 없다. 아래 {@link Rules} 는 <b>테스트 전용 가짜 규칙</b>이며 연결 지점이 규칙 결과를 그대로 싣는지만 본다. 실제
 * 판정이 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, QuestionApiTest.Rules.class})
@Transactional
class QuestionApiTest {
    private static final String PLACE = "q-test";
    private static final String EXP = "sha256:" + "e".repeat(64);
    private static final String OLD_EXP = "sha256:" + "f".repeat(64);
    private static final String RESP = "resp:" + "1".repeat(64);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @TestConfiguration(proxyBeanMethods = false)
    static class Rules {
        @Bean
        CardRule c1() {
            return rule(
                    "C1", "increasing", "calculated", "청년(15–39세) 순유출", new Condition(true, null));
        }

        @Bean
        CardRule a3() {
            return rule(
                    "A3",
                    "not_comparable",
                    "observed_fact",
                    "PM2.5",
                    new Condition(false, "주소 다름"));
        }

        private static CardRule rule(
                String card, String claim, String level, String indicator, Condition boundary) {
            Condition ok = new Condition(true, null);
            return new CardRule() {
                public String cardId() {
                    return card;
                }

                public String formulaVersion() {
                    return card.toLowerCase() + "-test-0.1";
                }

                public String warrant() {
                    return "테스트 보증";
                }

                public List<String> ceiling() {
                    return List.of("테스트 상한선");
                }

                public Judgment judge(
                        String placeId, LocalDate start, LocalDate end, int cardVersion) {
                    return new Judgment(
                            claim,
                            level,
                            indicator,
                            new Comparability(ok, ok, boundary, ok),
                            List.of("ev_test_stat"),
                            List.of(),
                            List.of());
                }
            };
        }
    }

    @BeforeEach
    void seed() {
        jdbc.update("INSERT INTO place(place_id,name,level) VALUES (?, '여수시', 'sigungu')", PLACE);
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('q_stat', 'KOSIS 인구이동', '통계청', 'KOSIS', 'full', 'A')");
        jdbc.update(
                "INSERT INTO evidence(evidence_id,kind,title,source_id,source_grade,license_type,"
                        + "storage_scope,observed_at,period_start,period_end,collected_at,locator)"
                        + " VALUES ('ev_test_stat','statistics','순이동','q_stat','A','KOSIS','full',"
                        + "'2025-12-31T00:00:00+09:00','2023-01-01','2026-01-01',now(),'{}')");
        // -136 세출 후보: 회계연도 2024(기간 안) · 2021(기간 밖)
        expenditure(EXP, 2024, "1");
        expenditure(OLD_EXP, 2021, "2");
    }

    /** 세출 한 줄 + C1 · A3 후보. 후보 ID 는 resp: + (카드별 접두 + digit 반복). */
    private void expenditure(String id, int year, String digit) {
        jdbc.update(
                "INSERT INTO local_expenditure VALUES (?, ?, '전남', '여수시', '46130', '일반회계',"
                        + " '청년 미세먼지 사업', 1000, 0, 0, 1000, 0, 900, 100, null, null, 'f.xlsx',"
                        + " '공공데이터', 'full', now(), 'test')",
                id,
                year);
        for (String card : List.of("C1", "A3")) {
            jdbc.update(
                    "INSERT INTO existing_response (response_id, card_id, origin, origin_ref,"
                            + " expenditure_id, place_code_raw, place_id, name, fiscal_year,"
                            + " field_sources, extracted_by, selection_reason, rule_version)"
                            + " VALUES (?, ?, 'lofin', ?, ?, '46130', ?, '청년 미세먼지 사업', ?, '{}',"
                            + " 'rule', '테스트', 'existing-0.1')",
                    "resp:"
                            + (card.equals("C1") ? "" : "a")
                            + digit.repeat(card.equals("C1") ? 64 : 63),
                    card,
                    id,
                    id,
                    PLACE,
                    year);
        }
    }

    private void lofin(String grade) {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('lofin', '지방재정365 세출', '행정안전부', '공공데이터', 'full', ?)",
                grade);
    }

    private void statistics(String card) {
        jdbc.update(
                "INSERT INTO card_evidence_status VALUES (?, ?, 1, '2023-01-01', '2026-01-01',"
                        + " 'statistics', 'available', 0)",
                PLACE,
                card);
    }

    private ResultActions ask(String body) throws Exception {
        return mvc.perform(
                post("/v1/questions")
                        .with(user("u"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private static String body(String card, String start, String end) {
        return """
                {"place_id": "%s", "card_id": %s, "period_start": "%s", "period_end": "%s",
                 "raw_text": null}
                """
                .formatted(PLACE, card == null ? "null" : "\"" + card + "\"", start, end);
    }

    private String runId(ResultActions created) throws Exception {
        String json =
                created.andExpect(status().isCreated())
                        .andExpect(C2Contract.matches("question-create-response"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return JsonPath.read(json, "$.run_id");
    }

    private ResultActions argument(String runId) throws Exception {
        return mvc.perform(get("/v1/arguments/{id}", runId).with(user("u")))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("argument"));
    }

    @Test
    void eachRunGetsNewIdAndPastResultsStay() throws Exception {
        String first = runId(ask(body("C1", "2023-01-01", "2026-01-01")));
        String before = argument(first).andReturn().getResponse().getContentAsString();
        String second = runId(ask(body("C1", "2023-01-01", "2026-01-01")));

        assertThat(second).isNotEqualTo(first);
        assertThat(argument(first).andReturn().getResponse().getContentAsString())
                .isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM question", Integer.class))
                .isEqualTo(2);
    }

    @Test
    void c1WithoutStatisticsIsBlockedAndInsufficient() throws Exception {
        argument(runId(ask(body("C1", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.run_status").value("blocked"))
                .andExpect(jsonPath("$.formula_version").value("c1-test-0.1"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.claim.text").value("필수 근거(통계)가 없어 판단하지 않습니다."))
                .andExpect(jsonPath("$.evidence_table[0].status").value("not_collected"))
                .andExpect(jsonPath("$.data.statistics.length()").value(0));
    }

    @Test
    void nullCardIsStoredAsCandidateAndUnsupported() throws Exception {
        String created =
                ask(body(null, "2025-01-01", "2026-01-01"))
                        .andExpect(status().isCreated())
                        .andExpect(C2Contract.matches("question-create-response"))
                        .andExpect(jsonPath("$.candidate").value(true))
                        .andExpect(jsonPath("$.run_status").value("unsupported"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        argument(JsonPath.read(created, "$.run_id"))
                .andExpect(jsonPath("$.question.card_id").doesNotExist())
                .andExpect(jsonPath("$.card_version").isEmpty())
                .andExpect(jsonPath("$.claim.value").value("insufficient"));
        assertThat(jdbc.queryForObject("SELECT card_id FROM question", String.class)).isNull();
    }

    @Test
    void c1RuleResultAndGradedExistingResponsesAreLinked() throws Exception {
        statistics("C1");
        lofin("A");
        String runId = runId(ask(body("C1", "2023-01-01", "2026-01-01")));

        String evidence = "ev_" + "1".repeat(64);
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("partial"))
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                .andExpect(
                        jsonPath("$.claim.text").value("여수시의 2023–2025 청년(15–39세) 순유출 값이 늘었습니다."))
                .andExpect(jsonPath("$.data.statistics[0].evidence_id").value("ev_test_stat"))
                // 2021 세출은 기간 밖이라 잇지 않는다
                .andExpect(jsonPath("$.data.existing_responses.length()").value(1))
                .andExpect(jsonPath("$.data.existing_responses[0].evidence_id").value(evidence))
                .andExpect(jsonPath("$.data.existing_responses[0].period_start").isEmpty())
                .andExpect(jsonPath("$.evidence_table[2].status").value("available"))
                .andExpect(jsonPath("$.warrant.text").value("테스트 보증"))
                .andExpect(jsonPath("$.qualifier.grade").value("medium"));
        assertThat(
                        jdbc.queryForList(
                                "SELECT kind, evidence_id, response_id FROM argument_run_source"
                                        + " WHERE run_id = ? ORDER BY kind",
                                runId))
                .extracting(
                        r ->
                                r.get("kind")
                                        + "|"
                                        + r.get("evidence_id")
                                        + "|"
                                        + r.get("response_id"))
                .containsExactly(
                        "existing_responses|" + evidence + "|" + RESP,
                        "statistics|ev_test_stat|null");
    }

    @Test
    void a3NotComparableAndUngradedResponsesStayPending() throws Exception {
        statistics("A3");
        lofin(null);
        String runId = runId(ask(body("A3", "2023-01-01", "2026-01-01")));

        argument(runId)
                .andExpect(jsonPath("$.claim.value").value("not_comparable"))
                .andExpect(
                        jsonPath("$.claim.text")
                                .value(org.hamcrest.Matchers.containsString("같은 경계")))
                .andExpect(jsonPath("$.comparability.same_boundary.passed").value(false))
                .andExpect(jsonPath("$.evidence_table[2].status").value("review_pending"))
                .andExpect(jsonPath("$.evidence_table[2].review_pending_count").value(1))
                .andExpect(jsonPath("$.data.existing_responses.length()").value(0));
        // 등급 없는 출처의 후보는 근거로 만들지 않고 후보 ID 만 남긴다
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM evidence WHERE kind = 'existing_responses'",
                                Integer.class))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM argument_run_source WHERE run_id = ?"
                                        + " AND evidence_id IS NULL AND response_id IS NOT NULL",
                                Integer.class,
                                runId))
                .isEqualTo(1);
    }

    @Test
    void cardWithoutRuleIsNotJudged() throws Exception {
        jdbc.update("INSERT INTO card VALUES ('Z9', '규칙 없음', 'Z 테스트', '?', 1, 'tax-2026.10')");
        statistics("Z9");
        argument(runId(ask(body("Z9", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.formula_version").isEmpty())
                .andExpect(jsonPath("$.claim.text").value("이 카드의 판정 규칙이 아직 연결되지 않아 판단하지 않습니다."));
    }

    @Test
    void invalidRequestsUseCommonErrors() throws Exception {
        ask(body("C1", "2026-01-01", "2026-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        ask(body("C1", "2026-13-01", "2027-01-01")).andExpect(status().isBadRequest());
        ask("{\"card_id\": \"C1\", \"period_start\": \"2025-01-01\", \"period_end\": \"2026-01-01\"}")
                .andExpect(status().isBadRequest());
        ask(body("C1", "2025-01-01", "2026-01-01").replace(PLACE, "nowhere"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        ask(body("NOPE", "2025-01-01", "2026-01-01")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/arguments/run_missing").with(user("u")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        mvc.perform(get("/v1/arguments/run_missing")).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM question", Integer.class)).isZero();
    }
}
