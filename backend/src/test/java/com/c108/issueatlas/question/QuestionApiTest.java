package com.c108.issueatlas.question;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import com.c108.issueatlas.card.dto.CardStorageDto.Approve;
import com.c108.issueatlas.card.dto.CardStorageDto.CreateCard;
import com.c108.issueatlas.card.dto.CardStorageDto.SaveDraft;
import com.c108.issueatlas.card.service.CardStorageService;
import com.c108.issueatlas.question.service.PhrasingCache;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 질문 저장 → 실행 → 결과 조회(S15P31C108-133). Flyway 실제 적용 + 보안 + SQL + C2 스키마. 각 테스트 자료는 롤백한다.
 *
 * <p>C1 · A3는 운영 seed의 승인본 v2와 실제 규칙 종류 실행기로 판정한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class QuestionApiTest {
    private static final String PLACE = "q-test";
    private static final String EXP = "sha256:" + "e".repeat(64);
    private static final String OLD_EXP = "sha256:" + "f".repeat(64);
    private static final String RESP = "resp:" + "1".repeat(64);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CardStorageService storage;
    @Autowired ObjectMapper json;
    @Autowired PhrasingCache phrasingCache;

    // 가짜 engine(contracts/ai v0.2 「문장화」). 테스트마다 답을 정하고 받은 요청을 남긴다. 기본 503 → 카드 문구
    private record EngineAnswer(int status, String body, long delayMs) {}

    private static final List<String> ENGINE_REQUESTS = new CopyOnWriteArrayList<>();
    private static volatile EngineAnswer engineAnswer;
    private static final HttpServer ENGINE = fakeEngine();

    private static HttpServer fakeEngine() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext(
                    "/v1/argument/phrase",
                    exchange -> {
                        ENGINE_REQUESTS.add(
                                new String(
                                        exchange.getRequestBody().readAllBytes(),
                                        StandardCharsets.UTF_8));
                        EngineAnswer answer = engineAnswer;
                        try {
                            Thread.sleep(answer.delayMs());
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                        byte[] body = answer.body().getBytes(StandardCharsets.UTF_8);
                        exchange.getResponseHeaders().add("Content-Type", "application/json");
                        exchange.sendResponseHeaders(
                                answer.status(), body.length == 0 ? -1 : body.length);
                        if (body.length > 0) {
                            exchange.getResponseBody().write(body);
                        }
                        exchange.close();
                    });
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @DynamicPropertySource
    static void engine(DynamicPropertyRegistry registry) {
        registry.add(
                "issue-atlas.engine.url",
                () -> "http://127.0.0.1:" + ENGINE.getAddress().getPort());
        registry.add("issue-atlas.engine.timeout", () -> "1s");
    }

    @BeforeEach
    void seed() throws Exception {
        engineAnswer = new EngineAnswer(503, "", 0);
        ENGINE_REQUESTS.clear();
        // 테스트마다 같은 질문에 다른 engine 답을 쓰므로 앞 테스트의 문장화 결과를 지운다
        phrasingCache.clear();
        jdbc.queryForObject(
                "SELECT set_config('issue_atlas.approver', ?, true)",
                String.class,
                "admin@seed.test");
        jdbc.execute(Files.readString(Path.of("db/seed/cards-c1-a3.sql")));
        jdbc.update("INSERT INTO place(place_id,name,level) VALUES (?, '여수시', 'sigungu')", PLACE);
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('q_stat', 'KOSIS 인구이동', '통계청', 'KOSIS', 'full', 'A')");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class)"
                        + " VALUES ('airkorea_final_yeosu_gwangju','q_stat','api','statistics')");
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
                        + " VALUES ('lofin', '지방재정365 세출', '행정안전부', '공공데이터', 'full', ?)"
                        + " ON CONFLICT (source_id) DO UPDATE SET name = EXCLUDED.name,"
                        + " license_type = EXCLUDED.license_type",
                grade);
        // V0040 이 lofin 행을 미리 넣고 V0039 가 빈 등급을 채우므로, 시험할 등급은 넣은 뒤 다시 적는다
        jdbc.update("UPDATE source SET reliability_grade = ? WHERE source_id = 'lofin'", grade);
    }

    private void statistics(String card) {
        jdbc.update(
                "INSERT INTO card_evidence_status VALUES (?, ?, 2, '2023-01-01', '2026-01-01',"
                        + " 'statistics', 'available', 0)",
                PLACE,
                card);
    }

    private void air(String station, int year, int month, int value) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.plusMonths(1);
        jdbc.update(
                "INSERT INTO air_monthly(station_code,station_name,indicator_id,unit,month_start,month_end,"
                        + "month_hours,valid_hours,held_hours,value_mean,value_min,value_max,has_provisional)"
                        + " VALUES (?,?,'air_pm25','µg/m³',CAST(? AS date)::timestamp AT TIME ZONE 'Asia/Seoul',"
                        + "CAST(? AS date)::timestamp AT TIME ZONE 'Asia/Seoul',744,700,0,?,?,?,false)",
                station,
                station,
                start,
                end,
                value,
                value,
                value);
    }

    /** 질문 지역 기사 한 건을 카드 하나로 1차 분류해 둔다(V0035 표 → V0036 view 의 기사 tags). */
    private void classifiedArticle(String newsId, String card) {
        String hash = "sha256:news-" + newsId;
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at)"
                        + " VALUES ('run-q-news','airkorea_final_yeosu_gwangju','test',now())"
                        + " ON CONFLICT DO NOTHING");
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,collected_at)"
                        + " VALUES ('run-q-news','airkorea_final_yeosu_gwangju','https://bigkinds.or.kr',?,now())",
                hash);
        jdbc.update(
                "INSERT INTO news_event(news_id,summary,event_start,time_precision,place_id,sido)"
                        + " VALUES (?,'청년 유출 기사 요약',TIMESTAMPTZ '2024-05-01 00:00+09','day',?,"
                        + "'전남광주통합특별시')",
                newsId,
                PLACE);
        jdbc.update(
                "INSERT INTO document_search_input(input_id,doc_id,news_id,raw_content_hash,input_version,"
                        + "input_text,input_hash) VALUES ('dsi:' || encode(sha256(convert_to(?, 'UTF8')), 'hex'),"
                        + "'news:' || ?,?,?,'news-title-summary-v1','요약',"
                        + "encode(sha256(convert_to('요약', 'UTF8')), 'hex'))",
                newsId,
                newsId,
                newsId,
                hash);
        jdbc.update(
                "INSERT INTO document_embedding_v1(input_id,doc_id,model,embedding,is_active)"
                        + " SELECT input_id, doc_id, 'gemini-embedding-2',"
                        + " array_fill(0.01::real, ARRAY[1536])::vector, true"
                        + " FROM document_search_input WHERE news_id = ?",
                newsId);
        jdbc.update(
                "INSERT INTO card_search_profile(card_id,card_version,profile_version,profile_text,"
                        + "profile_hash,model,embedding,is_active)"
                        + " SELECT card_id, current_version, 'card-profile-v1', '이슈: ' || name,"
                        + " encode(sha256(convert_to(card_id, 'UTF8')), 'hex'), 'gemini-embedding-2',"
                        + " array_fill(0.01::real, ARRAY[1536])::vector, true FROM card WHERE card_id = ?",
                card);
        jdbc.update(
                "INSERT INTO document_card_score(doc_id,card_id,input_id,card_version,profile_version,model,"
                        + "cosine_similarity,threshold_version,threshold,selected)"
                        + " SELECT d.doc_id, c.card_id, d.input_id, c.current_version, 'card-profile-v1',"
                        + " 'gemini-embedding-2', 0.8, 'test', 0.7, true"
                        + " FROM document_embedding_v1 d, card c WHERE d.doc_id = 'news:' || ? AND c.card_id = ?",
                newsId,
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
        kosis(spec, indicator, locator, "M", month, value);
    }

    /** KOSIS 정제 한 행. type M 은 그 달 한 달, Y 는 그 해 한 해(start 는 1월 1일). */
    private void kosis(
            String spec, String indicator, String locator, String type, String start, int value) {
        String length = type.equals("Y") ? "1 year" : "1 month";
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS','통계청','KOGL-1','full','A') ON CONFLICT DO NOTHING");
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class)"
                        + " VALUES (?,'S01','api','statistics') ON CONFLICT DO NOTHING",
                spec);
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at)"
                        + " VALUES (?,?,'test',now()) ON CONFLICT DO NOTHING",
                "run-q-" + spec,
                spec);
        String hash = "sha256:" + spec + locator + start;
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
                        + " VALUES (?,'S01',?,?,'kosis','46130',?,CAST(? AS date)::timestamp AT TIME ZONE 'Asia/Seoul',"
                        + "(CAST(? AS date) + CAST(? AS interval))::timestamp AT TIME ZONE 'Asia/Seoul',?,'명','full',"
                        + "'pass','[]','p2-test','obs:' || encode(sha256(convert_to(?, 'UTF8')), 'hex'),true,"
                        + "jsonb_build_object('locator', ?::jsonb))",
                hash,
                spec,
                indicator,
                type,
                start,
                start,
                length,
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
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.evidence_table[0].status").value("available"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.comparability.same_period_length.passed").isEmpty())
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
                .andExpect(jsonPath("$.series[0].station_id").value("kr-12130-s336121"))
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
    void rerunPointsToPreviousRunOfSameQuestionAndKeepsMetrics() throws Exception {
        String first = runId(ask(body("C1", "2023-01-01", "2026-01-01")));
        String second = runId(ask(body("C1", "2023-01-01", "2026-01-01")));
        String other = runId(ask(body("C1", "2024-01-01", "2026-01-01")));

        Map<String, Object> a = metrics(first);
        Map<String, Object> b = metrics(second);
        assertThat(a.get("previous_run_id")).isNull();
        assertThat(b.get("previous_run_id")).isEqualTo(first);
        assertThat(metrics(other).get("previous_run_id")).isNull(); // 기간이 다르면 다른 질문
        // 통계 없는 C1: 판단 · 반박은 비고, 근거(세출 기존 대응 — V0040 lofin 출처 등급 B) · 보증 · 한정어 · 상한선이 찬다
        assertThat(a.get("filled_cells")).isEqualTo(4);
        assertThat(b.get("filled_cells")).isEqualTo(4);
        assertThat(a.get("edit_count")).isNull(); // 검수 기능 전
        assertThat((Integer) b.get("duration_ms")).isNotNegative();
    }

    private Map<String, Object> metrics(String runId) {
        return jdbc.queryForMap(
                "SELECT previous_run_id, filled_cells::int AS filled_cells, edit_count, duration_ms"
                        + " FROM argument_run WHERE run_id = ?",
                runId);
    }

    @Test
    void c1WithoutStatisticsIsBlockedAndInsufficient() throws Exception {
        argument(runId(ask(body("C1", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.run_status").value("blocked"))
                .andExpect(jsonPath("$.formula_version").value("c1-net-migration-0.1"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.claim.text").value("필수 근거(통계)가 없어 판단하지 않습니다."))
                .andExpect(jsonPath("$.claim.label").value(nullValue()))
                // 지역 단위는 늘 확인하고, 연 값 조건은 판정 전에 멈춰 확인하지 못한다. 대상은 표시만
                .andExpect(
                        jsonPath("$.applicability[*].condition")
                                .value(contains("place_level", "min_complete_years", "population")))
                .andExpect(jsonPath("$.applicability[0].passed").value(true))
                .andExpect(jsonPath("$.applicability[0].note").value("여수시(시군구)"))
                .andExpect(jsonPath("$.applicability[1].passed").value(nullValue()))
                .andExpect(jsonPath("$.applicability[1].note").value("필수 근거(통계)가 없어 확인하지 않음"))
                .andExpect(jsonPath("$.applicability[2].label").value("대상: 청년 19–39세"))
                .andExpect(jsonPath("$.applicability[2].passed").value(nullValue()))
                .andExpect(jsonPath("$.evidence_table[0].status").value("not_collected"))
                .andExpect(jsonPath("$.data.statistics.length()").value(0));
    }

    @Test
    void placeOfOtherLevelIsUnsupportedBeforeEvidence() throws Exception {
        jdbc.update("INSERT INTO place(place_id,name,level) VALUES ('q-emd', '중앙동', 'emd')");
        argument(runId(ask(body("C1", "2023-01-01", "2026-01-01").replace(PLACE, "q-emd"))))
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.claim.label").value(nullValue()))
                .andExpect(jsonPath("$.claim.text").value("이 카드는 시군구 단위 지역만 판단합니다."))
                .andExpect(jsonPath("$.applicability[0].label").value("시군구 단위"))
                .andExpect(jsonPath("$.applicability[0].passed").value(false))
                .andExpect(jsonPath("$.applicability[0].note").value("중앙동(읍면동)"))
                .andExpect(jsonPath("$.applicability[1].passed").value(nullValue()));
    }

    @Test
    void articleClassifiedAsC1IsInC1ArticlesOnly() throws Exception {
        classifiedArticle("n-q-c1", "C1");
        argument(runId(ask(body("C1", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.articles.length()").value(1))
                .andExpect(jsonPath("$.articles[0].id").value("n-q-c1"))
                .andExpect(jsonPath("$.articles[0].date").value("2024-05-01"))
                .andExpect(jsonPath("$.articles[0].summary").value("청년 유출 기사 요약"));
        argument(runId(ask(body("A3", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.articles.length()").value(0));
    }

    @Test
    void requiredStatisticsWithoutLinkedEvidenceDoesNotProduceClaim() throws Exception {
        statistics("A3");
        jdbc.update("DELETE FROM source_spec WHERE spec_id = 'airkorea_final_yeosu_gwangju'");
        argument(runId(ask(body("A3", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.run_status").value("blocked"))
                .andExpect(jsonPath("$.formula_version").value("a3-pm25-diff-0.2"))
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
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.claim.label").value(nullValue()))
                .andExpect(jsonPath("$.applicability.length()").value(0));
        assertThat(jdbc.queryForObject("SELECT card_id FROM question", String.class)).isNull();
    }

    @Test
    void gradedExistingResponsesAreLinked() throws Exception {
        statistics("A3");
        lofin("A");
        String runId = runId(ask(body("A3", "2023-01-01", "2026-01-01")));

        String evidence = "ev_a" + "1".repeat(63);
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.data.statistics.length()").value(1))
                // 2021 세출은 기간 밖이라 잇지 않는다
                .andExpect(jsonPath("$.data.existing_responses.length()").value(1))
                .andExpect(jsonPath("$.data.existing_responses[0].evidence_id").value(evidence))
                .andExpect(jsonPath("$.data.existing_responses[0].period_start").isEmpty())
                .andExpect(jsonPath("$.evidence_table[2].status").value("available"))
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("같은 측정소에서")))
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
                .hasSize(2)
                .first()
                .isEqualTo("existing_responses|" + evidence + "|resp:a" + "1".repeat(63));
    }

    /** YEOSU 의 판단 ① 문장: 승인본 결과 문장(claim_text)에 첫해 · 끝해 연 값(절댓값)을 넣는다(S15P31C108-282, Figma ①). */
    private static final String C1_CLAIM =
            "여수시 청년(19–39세) 순유출은 2023년 1,537명에서 2025년 2,262명으로 매년 커졌습니다.";

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
                .andExpect(jsonPath("$.claim.label").value("청년 순유출 확대"))
                .andExpect(jsonPath("$.claim.level").value("calculated"))
                .andExpect(jsonPath("$.claim.text").value(C1_CLAIM))
                .andExpect(jsonPath("$.applicability[1].passed").value(true))
                .andExpect(jsonPath("$.applicability[1].note").value("3개(2023–2025)"))
                .andExpect(jsonPath("$.comparability.same_period_length.passed").value(true))
                .andExpect(jsonPath("$.data.statistics.length()").value(1))
                .andExpect(jsonPath("$.data.statistics[0].source_grade").value("A"))
                .andExpect(jsonPath("$.data.statistics[0].period_start").value("2023-01-01"))
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("청년 순유출이")))
                .andExpect(jsonPath("$.ceiling.items[0]").value("떠난 이유"))
                // 카드 설계도의 예상 빈칸(expected_gaps)이 상한선 끝에 문장으로 붙는다(S15P31C108-265)
                .andExpect(
                        jsonPath("$.ceiling.items")
                                .value(
                                        org.hamcrest.Matchers.hasItems(
                                                "민원: 이용 허락이 없어 쓰지 않는다 (license_blocked)",
                                                "읍면동 순이동: 공표되지 않는다 (not_published)")))
                .andExpect(jsonPath("$.ceiling.items.length()").value(7))
                .andExpect(jsonPath("$.series[0].values.length()").value(36))
                // 분모 지표(SP10 주민등록인구) 관측이 없으면 분모 칸은 비고, 빈 칸마다 없는 이유가 있다
                .andExpect(jsonPath("$.evidence_table[3].kind").value("denominators"))
                .andExpect(jsonPath("$.evidence_table[3].status").value("not_collected"))
                .andExpect(
                        jsonPath("$.evidence_table[3].reason")
                                .value("카드의 분모 지표에 이 지역 · 기간 관측 값이 없습니다."))
                .andExpect(jsonPath("$.evidence_table[1].status").value("not_collected"))
                .andExpect(
                        jsonPath("$.evidence_table[1].reason")
                                .value("이 지역 · 기간 보도자료 가운데 카드 키워드에 맞는 글이 없습니다."))
                .andExpect(
                        jsonPath("$.evidence_table[0].reason")
                                .value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.denominators.length()").value(0))
                // 최신 근거 시점 = 마지막 달(2025-12)의 마지막 날 한국 0시. 끝 경계 2026-01-01 이 아니다(-272)
                .andExpect(
                        jsonPath("$.qualifier.components.latest_observed_at")
                                .value("2025-12-30T15:00:00Z"))
                .andExpect(jsonPath("$.qualifier.components.latest_within_one_year").value(true));
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
    void latestObservedAtIsLastDayOfLastObservedMonth() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        // 2024-12 까지만 있다. 분석 기간 끝(2026-01-01) 전 1년(2025-01-01)보다 앞이라 「1년 이내」가 아니다.
        // 끝 경계(2025-01-01 0시)를 시점으로 쓰면 1년 이내로 잘못 센다(-272)
        for (int i = 0; i < 24; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        argument(runId(ask(body)))
                .andExpect(jsonPath("$.data.statistics.length()").value(1))
                .andExpect(
                        jsonPath("$.qualifier.components.latest_observed_at")
                                .value("2024-12-30T15:00:00Z"))
                .andExpect(jsonPath("$.qualifier.components.latest_within_one_year").value(false));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT observed_at = TIMESTAMPTZ '2024-12-31 00:00+09'"
                                        + " FROM evidence WHERE kind = 'statistics'",
                                Boolean.class))
                .isTrue();
    }

    /** 정제된 보도자료 한 건(보도자료 계약 v0.3 C1 문서). site 는 yeosu(46130) · gwangju(29). */
    private void press(String site, String pressId, String title, String publishedOn) {
        String source = "press_" + site;
        String spec = "press_release_" + site;
        String code = site.equals("yeosu") ? "46130" : "29";
        String license = site.equals("yeosu") ? "KOGL-4" : "KOGL-미표시";
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES (?,?,?,?,'metadata','B') ON CONFLICT (source_id) DO NOTHING",
                source,
                site.equals("yeosu") ? "여수시 보도자료" : "광주광역시 보도자료",
                site.equals("yeosu") ? "여수시" : "광주광역시",
                license);
        jdbc.update("UPDATE source SET reliability_grade = 'B' WHERE source_id = ?", source);
        jdbc.update(
                "INSERT INTO source_spec(spec_id,source_id,method,evidence_class)"
                        + " VALUES (?,?,'board','documents') ON CONFLICT DO NOTHING",
                spec,
                source);
        jdbc.update(
                "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at)"
                        + " VALUES (?,?,'test',now()) ON CONFLICT DO NOTHING",
                "run-q-" + spec,
                spec);
        String hash = "sha256:press-" + pressId;
        String link = "https://press.test/view?idx=" + pressId;
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,collected_at)"
                        + " VALUES (?,?,'https://press.test',?,now())",
                "run-q-" + spec,
                spec,
                hash);
        jdbc.update(
                "INSERT INTO normalized_record(content_hash,source_id,spec_id,place_code_system,"
                        + "place_code_raw,observed_period_type,storage_scope,validation_status,issues,"
                        + "rule_version,obs_key,is_latest,record)"
                        + " VALUES (?,?,?,'kosis',?,'none','metadata','pass','[]','p2-test',"
                        + "'obs:' || encode(sha256(convert_to(?, 'UTF8')), 'hex'),true,"
                        + "jsonb_build_object('document', jsonb_build_object('kind','press_release',"
                        + "'title',?::text,'link',?::text,'body',null),'published_at',?::text,"
                        + "'collected_at','2026-11-05T00:00:00Z','license_type',?::text,"
                        + "'locator',jsonb_build_object('press_id',?::text)))",
                hash,
                source,
                spec,
                code,
                pressId,
                title,
                link,
                publishedOn + "T00:00:00+09:00",
                license,
                pressId);
    }

    @Test
    void c1DocumentsAreLinkedFromPressReleasesMatchingCardKeywords() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        // C1 키워드 「청년 정착」의 낱말이 모두 든 제목 · 기간 안 → 근거
        press("yeosu", "yeosu:1", "여수시, 2024년 청년어촌정착지원 사업 대상자 모집", "2023-11-12");
        // 키워드 없음 · 기간 밖 · 광주광역시(시 전체 kr-29, 여수 질문과 다른 지역) → 근거 아님
        press("yeosu", "yeosu:2", "여수시, 비대면 무인민원발급기 확대 운영", "2024-03-01");
        press("yeosu", "yeosu:3", "여수시, 2026년 청년어촌정착 지원사업 대상자 모집", "2026-02-01");
        press("gwangju", "gwangju:4", "광주시, 청년 정착 지원 확대", "2024-05-01");
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String result =
                argument(runId(ask(body)))
                        .andExpect(jsonPath("$.claim.value").value("increasing"))
                        .andExpect(jsonPath("$.evidence_table[1].kind").value("documents"))
                        .andExpect(jsonPath("$.evidence_table[1].status").value("available"))
                        .andExpect(jsonPath("$.evidence_table[1].count").value(1))
                        .andExpect(
                                jsonPath("$.evidence_table[1].reason")
                                        .value(org.hamcrest.Matchers.nullValue()))
                        .andExpect(jsonPath("$.data.documents.length()").value(1))
                        .andExpect(
                                jsonPath("$.data.documents[0].evidence_id")
                                        .value(org.hamcrest.Matchers.startsWith("ev_doc_")))
                        .andExpect(
                                jsonPath("$.data.documents[0].title")
                                        .value("여수시, 2024년 청년어촌정착지원 사업 대상자 모집"))
                        .andExpect(jsonPath("$.data.documents[0].source_name").value("여수시 보도자료"))
                        .andExpect(jsonPath("$.data.documents[0].source_grade").value("B"))
                        .andExpect(jsonPath("$.data.documents[0].storage_scope").value("metadata"))
                        // 통계(A) · 문서(B) 두 갈래 → 독립 근거 2
                        .andExpect(jsonPath("$.qualifier.components.independent_evidence").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String evidenceId = JsonPath.read(result, "$.data.documents[0].evidence_id");
        // 근거 상세에서 원문 링크로 간다(본문 없음)
        mvc.perform(get("/v1/evidence/{id}", evidenceId).with(user("u")))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("evidence"))
                .andExpect(jsonPath("$.kind").value("documents"))
                .andExpect(jsonPath("$.url").value("https://press.test/view?idx=yeosu:1"))
                .andExpect(jsonPath("$.published_at").value(org.hamcrest.Matchers.notNullValue()))
                .andExpect(jsonPath("$.display").value(org.hamcrest.Matchers.nullValue()));
        // 다시 실행해도 같은 글 같은 판은 근거 한 행
        runId(ask(body));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM evidence WHERE kind = 'documents'",
                                Integer.class))
                .isEqualTo(1);
    }

    @Test
    void documentsAreListedByPublishedDateNotEvidenceId() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        // 근거 ID 는 yeosu:5(ev_doc_2f19…)가 yeosu:1(ev_doc_d527…)보다 앞이지만 등록일은 늦다
        press("yeosu", "yeosu:5", "[기획] 청년 유입의 새로운 시작점, 여수 청년마을", "2025-04-22");
        press("yeosu", "yeosu:1", "여수시, 2024년 청년어촌정착지원 사업 대상자 모집", "2023-11-12");
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String result =
                argument(runId(ask(body)))
                        .andExpect(jsonPath("$.data.documents.length()").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        List<String> ids = JsonPath.read(result, "$.data.documents[*].evidence_id");
        assertThat(ids.get(0)).isGreaterThan(ids.get(1)); // ID 순이면 거꾸로다
        assertThat(JsonPath.<List<String>>read(result, "$.data.documents[*].title"))
                .containsExactly("여수시, 2024년 청년어촌정착지원 사업 대상자 모집", "[기획] 청년 유입의 새로운 시작점, 여수 청년마을");
    }

    /** 여수 SP10 주민등록인구 연말 값 2023–2025(개발 DB 실데이터). */
    private static final int[] YEOSU_REGISTERED = {271696, 267816, 263284};

    @Test
    void c1DenominatorIsLinkedFromRegisteredPopulation() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        for (int i = 0; i < YEOSU_REGISTERED.length; i++) {
            String year = LocalDate.of(2023 + i, 1, 1).toString();
            kosis(
                    "SP10",
                    "population_registered",
                    "{\"C2\": \"000\"}",
                    "Y",
                    year,
                    YEOSU_REGISTERED[i]);
        }
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String result =
                argument(runId(ask(body)))
                        .andExpect(jsonPath("$.claim.value").value("increasing"))
                        .andExpect(jsonPath("$.evidence_table[3].kind").value("denominators"))
                        .andExpect(jsonPath("$.evidence_table[3].status").value("available"))
                        .andExpect(jsonPath("$.evidence_table[3].count").value(1))
                        .andExpect(
                                jsonPath("$.evidence_table[3].reason")
                                        .value(org.hamcrest.Matchers.nullValue()))
                        .andExpect(jsonPath("$.data.denominators.length()").value(1))
                        .andExpect(
                                jsonPath("$.data.denominators[0].evidence_id")
                                        .value(org.hamcrest.Matchers.startsWith("ev_den_")))
                        .andExpect(
                                jsonPath("$.data.denominators[0].title")
                                        .value("KOSIS 인구이동 · 주민등록인구 (연말)"))
                        .andExpect(jsonPath("$.data.denominators[0].source_grade").value("A"))
                        .andExpect(
                                jsonPath("$.data.denominators[0].period_start").value("2023-01-01"))
                        // 분모는 한정어 구성 값에서 뺀다(qualifier-0.1): 독립 근거는 통계 하나 그대로
                        .andExpect(jsonPath("$.qualifier.components.independent_evidence").value(1))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String runId = JsonPath.read(result, "$.run_id");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM argument_run_source"
                                        + " WHERE run_id = ? AND kind = 'denominators'",
                                Integer.class,
                                runId))
                .isEqualTo(1);
        // 다시 실행해도 분모 근거는 한 행
        runId(ask(body));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM evidence WHERE kind = 'denominators'",
                                Integer.class))
                .isEqualTo(1);
        // 연 값(2025 한 해)의 시점도 그 해 마지막 날(-272)
        assertThat(
                        jdbc.queryForObject(
                                "SELECT observed_at = TIMESTAMPTZ '2025-12-31 00:00+09'"
                                        + " FROM evidence WHERE kind = 'denominators'",
                                Boolean.class))
                .isTrue();
    }

    /** 여수 C1 2023–2025: 통계(SP01) · 문서(보도자료 1) · 기존 대응(세출 2024, 등급 grade) · 분모(SP10). */
    private void yeosuC1(String grade) {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        for (int i = 0; i < YEOSU_REGISTERED.length; i++) {
            String year = LocalDate.of(2023 + i, 1, 1).toString();
            kosis(
                    "SP10",
                    "population_registered",
                    "{\"C2\": \"000\"}",
                    "Y",
                    year,
                    YEOSU_REGISTERED[i]);
        }
        press("yeosu", "yeosu:1", "여수시, 2024년 청년어촌정착지원 사업 대상자 모집", "2023-11-12");
        lofin(grade);
        jdbc.update("UPDATE existing_response SET place_id = 'kr-12130' WHERE card_id = 'C1'");
    }

    private ResultActions cards(String place) throws Exception {
        return mvc.perform(
                        get("/v1/places/{place}/cards", place)
                                .with(user("u"))
                                .param("period_start", "2023-01-01")
                                .param("period_end", "2026-01-01"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("place-cards"));
    }

    private int evidenceRows() {
        return jdbc.queryForObject("SELECT count(*) FROM evidence", Integer.class);
    }

    @Test
    void cardListCountsEvidenceLiveWithoutSavingAndMatchesTheRun() throws Exception {
        yeosuC1("A");
        int before = evidenceRows();
        // 질문을 실행하기 전에도 고른 기간으로 바로 센다. 근거 행은 만들지 않는다(조회)
        String list =
                cards("kr-12130")
                        .andExpect(jsonPath("$.cards[1].card_id").value("C1"))
                        .andExpect(jsonPath("$.cards[1].available_kinds").value(4))
                        .andExpect(jsonPath("$.cards[1].review_pending_count").value(0))
                        // A3 는 이 지역 측정 자료 · 후보가 없다
                        .andExpect(jsonPath("$.cards[0].card_id").value("A3"))
                        .andExpect(jsonPath("$.cards[0].available_kinds").value(0))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        assertThat(evidenceRows()).isEqualTo(before);

        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String result =
                argument(runId(ask(body)))
                        .andExpect(jsonPath("$.run_status").value("ready"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        // 두 화면이 같은 규칙: 카드 목록의 4종 상태 = 실행의 근거 수요표
        assertThat(JsonPath.<List<String>>read(list, "$.cards[1].evidence[*].status"))
                .containsExactly("available", "available", "available", "available")
                .isEqualTo(JsonPath.read(result, "$.evidence_table[*].status"));
        // 실행 뒤 다시 골라도 그대로(지난 실행 결과가 아니라 같은 자료를 다시 센다)
        cards("kr-12130").andExpect(jsonPath("$.cards[1].available_kinds").value(4));
    }

    @Test
    void cardListKeepsRegisteredStatusAndCountsUngradedResponsesAsPending() throws Exception {
        yeosuC1(null);
        // 등록된 확보 상태(수동)가 센 값보다 먼저다
        jdbc.update(
                "INSERT INTO card_evidence_status VALUES ('kr-12130', 'C1', 2, '2023-01-01',"
                        + " '2026-01-01', 'denominators', 'license_blocked', 0)");
        String list =
                cards("kr-12130")
                        .andExpect(
                                jsonPath("$.cards[1].evidence[2].status").value("review_pending"))
                        .andExpect(jsonPath("$.cards[1].review_pending_count").value(1))
                        .andExpect(
                                jsonPath("$.cards[1].evidence[3].status").value("license_blocked"))
                        .andExpect(jsonPath("$.cards[1].available_kinds").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String body =
                """
                {"place_id": "kr-12130", "card_id": "C1", "period_start": "2023-01-01",
                 "period_end": "2026-01-01", "raw_text": null}
                """;
        String result = argument(runId(ask(body))).andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<String>>read(list, "$.cards[1].evidence[*].status"))
                .isEqualTo(JsonPath.read(result, "$.evidence_table[*].status"));
        assertThat(JsonPath.<List<Integer>>read(result, "$.evidence_table[*].review_pending_count"))
                .containsExactly(0, 0, 1, 0);
    }

    @Test
    void cardListDoesNotLinkDocumentsWithoutStatistics() throws Exception {
        // 통계가 없으면 실행은 판정하지 않아 문서 · 분모를 잇지 않는다 — 목록도 같다
        press("yeosu", "yeosu:1", "여수시, 2024년 청년어촌정착지원 사업 대상자 모집", "2023-11-12");
        cards("kr-12130")
                .andExpect(jsonPath("$.cards[1].evidence[0].status").value("not_collected"))
                .andExpect(jsonPath("$.cards[1].evidence[1].status").value("not_collected"))
                .andExpect(jsonPath("$.cards[1].available_kinds").value(0));
    }

    @Test
    void c1TwoCompleteYearsAreUnsupportedByCardApplicability() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < 24; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        String runId =
                runId(ask(body("C1", "2023-01-01", "2025-01-01").replace(PLACE, "kr-12130")));
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(jsonPath("$.claim.label").value(nullValue()))
                .andExpect(jsonPath("$.claim.text").value("완전한 연 값 3개 이상이 필요해 판단하지 않습니다."))
                .andExpect(jsonPath("$.applicability[1].label").value("완전한 연 값 3개 이상"))
                .andExpect(jsonPath("$.applicability[1].passed").value(false))
                .andExpect(jsonPath("$.applicability[1].note").value("2개(2023–2024)"))
                .andExpect(jsonPath("$.evidence_table[0].status").value("available"))
                .andExpect(jsonPath("$.data.statistics.length()").value(1));
    }

    @Test
    void a3TwoCompleteYearsAreUnsupportedByCardApplicability() throws Exception {
        for (int month = 1; month <= 9; month++) {
            air("336121", 2023, month, 10);
            air("336121", 2024, month, 11);
        }
        String runId =
                runId(ask(body("A3", "2023-01-01", "2025-01-01").replace(PLACE, "kr-12130")));
        argument(runId)
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.claim.value").value("insufficient"))
                .andExpect(
                        jsonPath("$.applicability[*].condition")
                                .value(
                                        contains(
                                                "place_level",
                                                "min_complete_years",
                                                "min_stations")))
                .andExpect(jsonPath("$.applicability[1].passed").value(false))
                .andExpect(jsonPath("$.applicability[2].passed").value(true))
                .andExpect(jsonPath("$.applicability[2].note").value("측정소 1곳"))
                .andExpect(jsonPath("$.evidence_table[0].status").value("available"));
    }

    @Test
    void a3NotComparableAndUngradedResponsesStayPending() throws Exception {
        lofin(null);
        jdbc.update("UPDATE existing_response SET place_id = 'kr-12130' WHERE card_id = 'A3'");
        for (int month = 1; month <= 9; month++) {
            air("336121", 2023, month, 10);
            air("336121", 2024, month, 11);
            air("336124", 2025, month, 13);
        }
        String runId =
                runId(ask(body("A3", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));

        argument(runId)
                .andExpect(jsonPath("$.claim.value").value("not_comparable"))
                .andExpect(
                        jsonPath("$.claim.text")
                                .value(
                                        "여수시에는 2023–2025 모든 해에 연평균이 있는 측정소가 없어"
                                                + " 초미세먼지(PM2.5) 연평균을 비교할 수 없습니다."))
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
    void a3UsesCommonStationsAndApprovedClaimTemplate() throws Exception {
        for (int month = 1; month <= 9; month++) {
            air("336121", 2023, month, 10);
            air("336121", 2024, month, 11);
            air("336121", 2025, month, 13);
            air("336124", 2025, month, 100);
        }
        String runId =
                runId(ask(body("A3", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));
        argument(runId)
                .andExpect(jsonPath("$.formula_version").value("a3-pm25-diff-0.2"))
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                .andExpect(jsonPath("$.claim.label").value("악화"))
                .andExpect(jsonPath("$.claim.level").value("calculated"))
                // 336124 는 2025 에만 있어 공통 측정소가 아니다 → 336121 하나의 첫해 · 끝해 연평균
                .andExpect(
                        jsonPath("$.claim.text")
                                .value(
                                        "여수시 측정소 1곳의 초미세먼지(PM2.5) 연평균은 2023년 10µg/m³에서"
                                                + " 2025년 13µg/m³로 높아졌습니다."))
                // 적용 조건의 측정소 수는 연평균이 있는 측정소 모두, 판정은 공통 측정소만
                .andExpect(jsonPath("$.applicability[2].note").value("측정소 2곳"))
                .andExpect(jsonPath("$.comparability.same_boundary.passed").value(true))
                .andExpect(jsonPath("$.data.statistics.length()").value(1));
    }

    @Test
    void approvedNewCardReusesRuleAndItsOutcomeSentenceWithoutJavaBean() throws Exception {
        storage.create(new CreateCard("C9", "청년 흐름", "C 인구·지역소멸", "청년은 이동하는가?"), "writer");
        ObjectNode draft =
                (ObjectNode) json.readTree(Files.readString(Path.of("../contracts/cards/C1.json")));
        draft.put("name", "청년 흐름");
        draft.put("parent_question", "청년은 이동하는가?");
        draft.put("claim_template", "{지역}의 청년(19–39세) 흐름: {기간} {판정값}");
        storage.saveDraft("C9", new SaveDraft(0L, draft), "writer");
        storage.approve("C9", new Approve(1L, "새 카드 규칙 재사용"), "approver");
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        String runId =
                runId(ask(body("C9", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));
        argument(runId)
                .andExpect(jsonPath("$.card_version").value(1))
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                // 결과 이름과 결과 문장은 규칙(지표 한 행)에 있어 같은 규칙을 쓰는 카드가 같이 쓴다.
                // 카드의 claim_template 은 결과 문장이 없을 때만(ClaimTextTest)
                .andExpect(jsonPath("$.claim.text").value(C1_CLAIM))
                .andExpect(
                        jsonPath("$.series[0].indicator_id")
                                .value("population_net_migration_19_39"));
    }

    @Test
    void cardWithoutRuleIsNotJudged() throws Exception {
        jdbc.update(
                "INSERT INTO card(card_id,name,domain,parent_question,card_version,taxonomy_version,status) VALUES ('Z9', '규칙 없음', 'Z 테스트', '?', 1, 'tax-2026.10','legacy')");
        statistics("Z9");
        argument(runId(ask(body("Z9", "2023-01-01", "2026-01-01"))))
                .andExpect(jsonPath("$.run_status").value("unsupported"))
                .andExpect(jsonPath("$.formula_version").isEmpty())
                .andExpect(jsonPath("$.claim.text").value("이 카드의 판정 규칙이 아직 연결되지 않아 판단하지 않습니다."))
                .andExpect(jsonPath("$.applicability.length()").value(0));
    }

    @Test
    void runsSavedBeforeLabelAndApplicabilityAreFilledByMigration() throws Exception {
        String runId = runId(ask(body("C1", "2023-01-01", "2026-01-01")));
        // C2 v1 전에 저장된 모양: 두 칸이 없다
        jdbc.update(
                "UPDATE argument_run SET result = (result - 'applicability') #- '{claim,label}'"
                        + " WHERE run_id = ?",
                runId);
        jdbc.execute(
                Files.readString(
                        Path.of(
                                "src/main/resources/db/migration/V0051__fill_argument_label_applicability.sql")));
        argument(runId)
                .andExpect(jsonPath("$.claim.label").value(nullValue()))
                .andExpect(jsonPath("$.applicability.length()").value(0))
                .andExpect(jsonPath("$.run_status").value("blocked"));
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
        assertThat(jdbc.queryForObject("SELECT count(*) FROM question", Integer.class)).isZero();
    }

    // ── 논증 문장화(S15P31C108-231 · -282): ⑤ 반박만 engine 결과로, ① 판단 · ③ 보증은 규칙 · 카드 그대로 ──

    private static final String PHRASED =
            """
            {"schema_version": "ai-phrasing-result-0.3", "run_id": "x", "status": "done",
             "reason_code": null, "retryable": false,
             "rebuttals": [{"text": "대학 진학 · 군 입대 연령의 구조적 전출 — 진학 전출 보도가 있다.",
                            "status": "supported", "provenance": "llm_judgment"}],
             "citations": {"C1-R1": [{"passage": "P1", "quote": "수도권 대학으로 진학",
               "locator": {"kind": "article", "source_id": "n1", "field": "summary", "sentence": 1,
                           "date": "2025-03-02", "url": null}}]},
             "problems": [], "model": "gemini-2.5-flash", "prompt_version": "argument-phrasing-v4"}
            """;
    // 옛 engine(결과 v0.2)은 warrant 를 같이 보낸다 — 배포 순서가 엇갈려도 ③ 은 카드 문장
    private static final String PHRASED_V02 =
            """
            {"schema_version": "ai-phrasing-result-0.2", "run_id": "x", "status": "done",
             "reason_code": null, "retryable": false,
             "warrant": {"text": "여수시 청년 순이동은 해마다 순유출이 커졌다.", "provenance": "llm_phrasing"},
             "rebuttals": [{"text": "대학 진학 · 군 입대 연령의 구조적 전출 — 진학 전출 보도가 있다.",
                            "status": "supported", "provenance": "llm_judgment"}],
             "citations": {"warrant": ["ev_stat_x"]},
             "problems": [], "model": "gemini-2.5-flash", "prompt_version": "argument-phrasing-v3"}
            """;
    private static final String REJECTED =
            """
            {"schema_version": "ai-phrasing-result-0.3", "run_id": "x", "status": "failed",
             "reason_code": "OUTPUT_REJECTED", "retryable": false, "rebuttals": [], "citations": {},
             "problems": [{"check": "number_mismatch", "where": "C1-R1", "detail": "2500"}],
             "model": "gemini-2.5-flash", "prompt_version": "argument-phrasing-v4"}
            """;

    /** C1 규칙이 판정하는 실행(c1RuleJudgesYearSumsOfMonthlyNetMigration 과 같은 자료). */
    private String judgedC1Run() throws Exception {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade)"
                        + " VALUES ('S01','KOSIS 인구이동','통계청','KOGL-1','full','A')");
        for (int i = 0; i < YEOSU.length; i++) {
            String month = LocalDate.of(2023, 1, 1).plusMonths(i).toString();
            kosis("SP01", "population_net_migration", "{\"C3\": \"905\"}", month, YEOSU[i]);
        }
        return runId(ask(body("C1", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));
    }

    private Map<String, Object> phrasing(String runId) {
        return jdbc.queryForMap(
                "SELECT status, reason_code, problems::text AS problems, citations::text AS citations,"
                        + " model FROM argument_phrasing WHERE run_id = ?",
                runId);
    }

    @Test
    void engineSentencesFillOnlyRebuttalsNotTheJudgmentOrWarrant() throws Exception {
        engineAnswer = new EngineAnswer(200, PHRASED, 0);
        String runId = judgedC1Run();
        argument(runId)
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                .andExpect(jsonPath("$.claim.provenance").value("rule"))
                .andExpect(jsonPath("$.claim.text").value(C1_CLAIM))
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("청년 순유출이")))
                .andExpect(jsonPath("$.warrant.provenance").value("card"))
                .andExpect(jsonPath("$.rebuttals[0].status").value("supported"))
                .andExpect(jsonPath("$.rebuttals[0].provenance").value("llm_judgment"))
                .andExpect(jsonPath("$.ceiling.provenance").value("card"));
        // 보낸 요청은 AI 계약 그대로: 판정 입력(연 값 3개 · 카드 반박 ID) + 기사 + 그 판의 카드 승인본
        String sent = ENGINE_REQUESTS.getLast();
        C2Contract.assertAiMatches("phrasing-request", sent);
        assertThat((List<?>) JsonPath.read(sent, "$.judgment.statistics_points")).hasSize(3);
        assertThat((String) JsonPath.read(sent, "$.judgment.statistics_points[0].period_start"))
                .isEqualTo("2023-01-01");
        assertThat((String) JsonPath.read(sent, "$.judgment.rebuttal_candidates[0].id"))
                .isEqualTo("C1-R1");
        assertThat((String) JsonPath.read(sent, "$.card.card_id")).isEqualTo("C1");
        Map<String, Object> row = phrasing(runId);
        assertThat(row.get("status")).isEqualTo("done");
        assertThat(row.get("reason_code")).isNull();
        assertThat((String) row.get("citations")).contains("C1-R1");
        // 반박이 차서 6칸이 모두 찬다
        assertThat(
                        jdbc.queryForObject(
                                "SELECT filled_cells FROM argument_run WHERE run_id = ?",
                                Integer.class,
                                runId))
                .isEqualTo(6);
    }

    @Test
    void oldEngineWarrantIsIgnored() throws Exception {
        engineAnswer = new EngineAnswer(200, PHRASED_V02, 0);
        argument(judgedC1Run())
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("청년 순유출이")))
                .andExpect(jsonPath("$.warrant.provenance").value("card"))
                .andExpect(jsonPath("$.rebuttals[0].provenance").value("llm_judgment"));
    }

    static Stream<Arguments> engineFailures() {
        return Stream.of(
                Arguments.of(new EngineAnswer(503, "", 0), "ENGINE_ERROR"),
                Arguments.of(new EngineAnswer(200, "not json", 0), "ENGINE_ERROR"),
                Arguments.of(
                        new EngineAnswer(422, "{\"reason_code\": \"INPUT_INVALID\"}", 0),
                        "INPUT_INVALID"),
                Arguments.of(new EngineAnswer(200, PHRASED, 1500), "ENGINE_TIMEOUT"),
                Arguments.of(new EngineAnswer(200, REJECTED, 0), "OUTPUT_REJECTED"));
    }

    @ParameterizedTest
    @MethodSource("engineFailures")
    void engineFailuresKeepCardTextAndRecordTheReason(EngineAnswer answer, String reason)
            throws Exception {
        engineAnswer = answer;
        String runId = judgedC1Run();
        argument(runId)
                .andExpect(jsonPath("$.claim.value").value("increasing"))
                .andExpect(
                        jsonPath("$.warrant.text")
                                .value(org.hamcrest.Matchers.startsWith("청년 순유출이")))
                .andExpect(jsonPath("$.warrant.provenance").value("card"))
                .andExpect(jsonPath("$.rebuttals.length()").value(0));
        Map<String, Object> row = phrasing(runId);
        assertThat(row.get("status")).isEqualTo("failed");
        assertThat(row.get("reason_code")).isEqualTo(reason);
        assertThat(((String) row.get("problems")).contains("number_mismatch"))
                .isEqualTo(reason.equals("OUTPUT_REJECTED"));
    }

    // ── 문장화 결과 캐시(S15P31C108-261) ──

    @Test
    void sameQuestionReusesTheDonePhrasingWithoutCallingTheEngineAgain() throws Exception {
        engineAnswer = new EngineAnswer(200, PHRASED, 0);
        String first = judgedC1Run();
        // engine 이 이번엔 실패하더라도 같은 입력이면 앞 done 결과를 쓴다
        engineAnswer = new EngineAnswer(503, "", 0);
        String second =
                runId(ask(body("C1", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));

        assertThat(second).isNotEqualTo(first);
        assertThat(ENGINE_REQUESTS).hasSize(1);
        argument(second)
                .andExpect(jsonPath("$.run_id").value(second))
                .andExpect(jsonPath("$.warrant.provenance").value("card"))
                .andExpect(jsonPath("$.rebuttals[0].status").value("supported"));
        Map<String, Object> row = phrasing(second);
        assertThat(row.get("status")).isEqualTo("done");
        assertThat(row.get("reason_code")).isNull();
        assertThat(row.get("model")).isEqualTo("gemini-2.5-flash");
        assertThat((String) row.get("citations")).contains("C1-R1");
    }

    @Test
    void failedPhrasingIsNotReusedAndDifferentInputsCallTheEngine() throws Exception {
        String first = judgedC1Run();
        assertThat(phrasing(first).get("reason_code")).isEqualTo("ENGINE_ERROR");
        engineAnswer = new EngineAnswer(200, PHRASED, 0);
        String again =
                runId(ask(body("C1", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));
        // 기간이 다르면 판정 입력이 달라 다른 키
        String otherPeriod =
                runId(ask(body("C1", "2024-01-01", "2026-01-01").replace(PLACE, "kr-12130")));

        assertThat(ENGINE_REQUESTS).hasSize(3);
        assertThat(phrasing(again).get("status")).isEqualTo("done");
        assertThat(phrasing(otherPeriod).get("status")).isEqualTo("done");
    }

    @Test
    void a3RequestCarriesStationYearValues() throws Exception {
        for (int month = 1; month <= 9; month++) {
            air("336121", 2023, month, 10);
            air("336121", 2024, month, 11);
            air("336121", 2025, month, 13);
        }
        String runId =
                runId(ask(body("A3", "2023-01-01", "2026-01-01").replace(PLACE, "kr-12130")));
        String sent = ENGINE_REQUESTS.getLast();
        C2Contract.assertAiMatches("phrasing-request", sent);
        // 측정소 연 값 3개 + 규칙이 계산한 시군구 연 값(공통 측정소 첫해 · 끝해 평균) 2개
        List<String> places = JsonPath.read(sent, "$.judgment.statistics_points[*].place_id");
        assertThat(places)
                .containsExactly(
                        "kr-12130-s336121",
                        "kr-12130-s336121",
                        "kr-12130-s336121",
                        "kr-12130",
                        "kr-12130");
        List<Number> values = JsonPath.read(sent, "$.judgment.statistics_points[3:].value");
        assertThat(values).extracting(Number::intValue).containsExactly(10, 13);
        assertThat(phrasing(runId).get("reason_code")).isEqualTo("ENGINE_ERROR");
    }

    @Test
    void phrasingRowNeedsItsRunAndReasonOnlyWhenNotDone() throws Exception {
        String runId = judgedC1Run();
        String insert =
                "INSERT INTO argument_phrasing (run_id, status, reason_code, duration_ms)"
                        + " VALUES (?, ?, ?, 0)";
        // 앞 실행의 기록이 이미 있으니 다른 실행 ID 로 본다: 없는 실행 · done 인데 사유 · 사유 없는 실패 · 모르는 사유
        for (Object[] row :
                List.of(
                        new Object[] {"run_missing", "done", null},
                        new Object[] {runId + "_x", "done", "LLM_ERROR"},
                        new Object[] {runId + "_x", "failed", null},
                        new Object[] {runId + "_x", "failed", "MAYBE"})) {
            // 제약 위반은 트랜잭션을 멈추므로 시도마다 savepoint 로 되돌린다
            jdbc.execute("SAVEPOINT phrasing_row");
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(insert, row))
                    .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            jdbc.execute("ROLLBACK TO SAVEPOINT phrasing_row");
        }
    }

    @Test
    void runsWithoutApprovedCardDoNotCallTheEngine() throws Exception {
        runId(ask(body(null, "2025-01-01", "2026-01-01")));
        assertThat(ENGINE_REQUESTS).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM argument_phrasing", Integer.class))
                .isZero();
    }

    @Test
    void anonymousCanAskWithCsrfAndReadArgument() throws Exception {
        String body = body("C1", "2025-01-01", "2026-01-01");
        mvc.perform(post("/v1/questions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        String runId =
                runId(
                        mvc.perform(
                                post("/v1/questions")
                                        .with(csrf())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body)));
        mvc.perform(get("/v1/arguments/" + runId)).andExpect(status().isOk());
        mvc.perform(get("/v1/arguments/run_missing")).andExpect(status().isNotFound());
    }
}
