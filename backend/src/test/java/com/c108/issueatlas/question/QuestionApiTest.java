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
 * <p>C1 은 실제 규칙({@code C1NetMigrationRule})으로 판정한다. A3 는 규칙이 아직 없어 아래 {@link Rules} 의 <b>테스트 전용 가짜
 * 규칙</b>으로 연결 지점이 규칙 결과를 그대로 싣는지만 본다.
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

                public String indicatorId() {
                    return "air_pm25";
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
                            null,
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

    /** observation view(V0025)가 읽는 KOSIS 정제 한 행. 기간은 그 달 한 달. */
    private void kosis(String spec, String indicator, String locator, String month, int value) {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope)"
                        + " VALUES ('S01','KOSIS','통계청','KOGL-1','full') ON CONFLICT DO NOTHING");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class)"
                        + " VALUES (?,'S01','api','statistics') ON CONFLICT DO NOTHING",
                spec);
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at)"
                        + " VALUES (?,?,'test',now()) ON CONFLICT DO NOTHING",
                "run-q-" + spec,
                spec);
        String hash = "sha256:" + spec + locator + month;
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,collected_at)"
                        + " VALUES (?,?,'https://kosis.kr',?,now())",
                "run-q-" + spec,
                spec,
                hash);
        jdbc.update(
                "INSERT INTO normalized_record(content_hash,source_id,spec_id,indicator_id,place_code_system,"
                        + "place_code_raw,observed_period_type,observed_period_start,observed_period_end,value,unit,"
                        + "storage_scope,validation_status,issues,rule_version,obs_key,is_latest,record)"
                        + " VALUES (?,'S01',?,?,'kosis','46130','M',CAST(? AS date)::timestamp AT TIME ZONE 'Asia/Seoul',"
                        + "(CAST(? AS date) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Seoul',?,'명','full',"
                        + "'pass','[]','p2-test','obs:' || encode(sha256(convert_to(?, 'UTF8')), 'hex'),true,"
                        + "jsonb_build_object('locator', ?::jsonb))",
                hash,
                spec,
                indicator,
                month,
                month,
                value,
                hash,
                locator);
    }

    @Test
    void cardRunCarriesMonthlySeriesFromObservationsEvenWithoutJudgment() throws Exception {
        kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", "2025-01-01", -30);
        kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", "2025-02-01", -40);
        kosis("SP01", "population_net_migration", "{\"C3\": \"000\"}", "2025-01-01", -90);
        kosis("SP02", "population_movers", "{\"C2\": \"11\"}", "2025-01-01", 12);
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2025-01-01",
                 "period_end": "2025-04-01", "raw_text": null}
                """;
        // 12개월이 모두 있는 해가 없어 근거 부족이지만 그림 자료(series)는 보낸다. 연령 계(000)는 카드 지표가 아니라 빠진다
        argument(runId(ask(body)))
                .andExpect(jsonPath("$.evidence_table[0].status").value("available"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.comparability.same_period_length.passed").value(false))
                .andExpect(jsonPath("$.series.length()").value(2))
                .andExpect(
                        jsonPath("$.series[0].indicator_id")
                                .value("population_net_migration_19_39"))
                .andExpect(jsonPath("$.series[0].name").value("여수시"))
                .andExpect(jsonPath("$.series[0].coordinates").isEmpty())
                .andExpect(jsonPath("$.series[0].periods[2]").value("2025-03"))
                .andExpect(jsonPath("$.series[0].values[1]").value(-40))
                .andExpect(jsonPath("$.series[0].values[2]").isEmpty())
                .andExpect(jsonPath("$.series[0].statuses[2]").value("not_collected"))
                .andExpect(jsonPath("$.series[1].from").value("kr-12130"))
                .andExpect(jsonPath("$.series[1].to").value("kr-11"))
                .andExpect(jsonPath("$.series[1].to_name").value("서울특별시"))
                .andExpect(jsonPath("$.series[1].values[0]").value(12))
                .andExpect(jsonPath("$.articles.length()").value(0));
    }

    @Test
    void a3SeriesIsOneLinePerStationWithCoordinates() throws Exception {
        jdbc.update(
                "INSERT INTO air_monthly(station_code,station_name,indicator_id,unit,month_start,month_end,"
                        + "month_hours,valid_hours,held_hours,value_mean,value_min,value_max,has_provisional)"
                        + " VALUES ('336121','서강동','air_pm25','µg/m³',TIMESTAMPTZ '2025-01-01 00:00+09',"
                        + "TIMESTAMPTZ '2025-02-01 00:00+09',744,700,0,15.3,1,30,false)");
        String body =
                """
                {"place_id": "kr-12130", "card_id": "A3", "period_start": "2025-01-01",
                 "period_end": "2025-03-01", "raw_text": null}
                """;
        argument(runId(ask(body)))
                .andExpect(jsonPath("$.series.length()").value(1))
                .andExpect(jsonPath("$.series[0].station_id").value("plc_stn_336121"))
                .andExpect(jsonPath("$.series[0].name").value("서강동"))
                .andExpect(jsonPath("$.series[0].coordinates.length()").value(2))
                .andExpect(jsonPath("$.series[0].values[0]").value(15.3))
                .andExpect(jsonPath("$.series[0].statuses[1]").value("not_collected"));
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
                .andExpect(jsonPath("$.formula_version").value("c1-net-migration-0.1"))
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
    void gradedExistingResponsesAreLinked() throws Exception {
        statistics("A3");
        lofin("A");
        String runId = runId(ask(body("A3", "2023-01-01", "2026-01-01")));

        String evidence = "ev_a" + "1".repeat(63);
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("partial"))
                .andExpect(jsonPath("$.claim.value").value("not_comparable"))
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
                        "existing_responses|" + evidence + "|resp:a" + "1".repeat(63),
                        "statistics|ev_test_stat|null");
    }

    /** 여수 SP01 19–39세 순이동 2023–2025(로컬 실데이터, C2 예시와 같은 값). 해 합계 −1537 · −1935 · −2262. */
    private static final int[] YEOSU = {
        -152, -198, -161, -136, -153, -159, -83, -163, -88, -89, -73, -82,
        -82, -122, -140, -129, -205, -75, -268, -273, -159, -124, -161, -197,
        -236, -356, -174, -124, -154, -131, -212, -237, -227, -125, -109, -177
    };

    @Test
    void c1RuleJudgesYearSumsOfMonthlyNetMigration() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String runId = runId(ask(body));
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("partial"))
                .andExpect(jsonPath("$.formula_version").value("c1-net-migration-0.1"))
                .andExpect(jsonPath("$.evidence_table[0].status").value("available"))
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                .andExpect(jsonPath("$.claim.level").value("calculated"))
                .andExpect(
                        jsonPath("$.claim.text")
                                .value("여수시의 2023–2025 청년(19–39세) 순이동 판정: 청년 순유출 확대."))
                .andExpect(jsonPath("$.comparability.same_period_length.passed").value(true))
                .andExpect(jsonPath("$.data.statistics.length()").value(1))
                .andExpect(jsonPath("$.data.statistics[0].source_grade").value("A"))
                .andExpect(jsonPath("$.data.statistics[0].period_start").value("2023-01-01"))
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("청년 순유출이")))
                .andExpect(jsonPath("$.ceiling.items[0]").value("떠난 이유"))
                .andExpect(jsonPath("$.series[0].values.length()").value(36));
        // 같은 지역 · 기간 · 지표는 같은 근거 한 행(다시 실행해도 늘지 않는다)
        runId(ask(body));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM evidence WHERE kind = 'statistics'"
                                        + " AND evidence_id LIKE 'ev_stat_%'",
                                Integer.class))
                .isEqualTo(1);
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
        jdbc.update(
                "INSERT INTO card(card_id,name,domain,parent_question,card_version,taxonomy_version,status) VALUES ('Z9', '규칙 없음', 'Z 테스트', '?', 1, 'tax-2026.10','legacy')");
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
