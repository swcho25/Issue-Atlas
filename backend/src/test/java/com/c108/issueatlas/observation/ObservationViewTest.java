package com.c108.issueatlas.observation;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0025 observation view 가 P2 · P3 표를 「시공간 표시 개발 명세」 3절 매핑대로 읽는지 확인한다. StationPlaceSeedTest 와 같은
 * 이유로 {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ObservationViewTest {
    private static final String ROW =
            "SELECT what_type, what_id, place_id, coalesce(to_place_id, '-') AS to_place,"
                    + " coalesce(station_id, '-') AS station, coalesce(tags[1], '-') AS tag, status"
                    + " FROM observation WHERE source_table = ? ORDER BY what_id";

    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void sources() {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope)"
                        + " VALUES ('S01','KOSIS','통계청','KOGL-1','full') ON CONFLICT DO NOTHING");
        for (String spec : List.of("SP01", "SP02", "SP10")) {
            jdbc.update(
                    "INSERT INTO source_spec(spec_id,source_id,method,evidence_class)"
                            + " VALUES (?,'S01','api','statistics') ON CONFLICT DO NOTHING",
                    spec);
            jdbc.update(
                    "INSERT INTO job_run(job_run_id,spec_id,collector_version,started_at)"
                            + " VALUES (?,?,'test',now())",
                    "run-obs-" + spec,
                    spec);
        }
    }

    @Test
    void SP10_연령_코드는_나이마다_지표_ID_이고_모르는_코드는_빠진다() {
        for (String age : List.of("000", "1005", "1201", "1305", "1501", "1605", "9999")) {
            stat("SP10", "population_registered", "46130", "{\"C2\": \"" + age + "\"}");
        }
        assertThat(
                        jdbc.queryForList(
                                "SELECT what_id FROM observation WHERE spec_id = 'SP10' ORDER BY what_id",
                                String.class))
                .containsExactly(
                        "population_registered_19",
                        "population_registered_20",
                        "population_registered_29",
                        "population_registered_30",
                        "population_registered_39",
                        "population_registered_total");
        // 카드 태그는 지표 사전과 같다: 19–39세 각 나이는 C1, 전체는 C1 · A3 의 분모 (V0031)
        assertThat(
                        jdbc.queryForList(
                                "SELECT what_id || ' ' || array_to_string(tags, ',') FROM observation"
                                        + " WHERE spec_id = 'SP10' ORDER BY what_id",
                                String.class))
                .containsExactly(
                        "population_registered_19 C1",
                        "population_registered_20 C1",
                        "population_registered_29 C1",
                        "population_registered_30 C1",
                        "population_registered_39 C1",
                        "population_registered_total C1,A3");
        // 옛 KOSIS 코드 46130 도 시군구 kr-12130 으로
        assertThat(
                        jdbc.queryForList(
                                "SELECT DISTINCT place_id FROM observation WHERE spec_id = 'SP10'",
                                String.class))
                .containsExactly("kr-12130");
    }

    @Test
    void 순이동은_연령을_지표_ID_로_이동은_도착_시도로_전국_합계는_뺀다() {
        stat("SP01", "population_net_migration", "12210", "{\"C3\": \"905\"}");
        stat("SP02", "population_movers", "46130", "{\"C2\": \"11\"}");
        stat("SP02", "population_movers", "46130", "{\"C2\": \"00\"}");
        assertThat(jdbc.queryForList(ROW, "normalized_record"))
                .containsExactly(
                        row(
                                "indicator",
                                "population_movers",
                                "kr-12130",
                                "kr-11",
                                "-",
                                "C1",
                                "available"),
                        row(
                                "indicator",
                                "population_net_migration_19_39",
                                "kr-12210",
                                "-",
                                "-",
                                "C1",
                                "available"));
    }

    @Test
    void 대기는_측정소와_시군구_기사는_글_한_건() {
        jdbc.update(
                "INSERT INTO air_monthly(station_code,station_name,indicator_id,unit,month_start,month_end,"
                        + "month_hours,valid_hours,held_hours,value_mean,value_min,value_max,has_provisional)"
                        + " VALUES ('336121','서강동','air_pm25','µg/m³',TIMESTAMPTZ '2024-01-01 00:00+09',"
                        + "TIMESTAMPTZ '2024-02-01 00:00+09',744,100,0,NULL,1,2,false)");
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,time_precision,sido)"
                        + " VALUES ('n-obs',TIMESTAMPTZ '2024-01-09 00:00+09','day','전남광주통합특별시')");
        assertThat(jdbc.queryForList(ROW, "air_monthly"))
                .containsExactly(
                        row(
                                "indicator",
                                "air_pm25",
                                "kr-12130",
                                "-",
                                "kr-12130-s336121",
                                "A3",
                                "not_published"));
        assertThat(jdbc.queryForList(ROW, "news_event"))
                .extracting(
                        r -> r.get("what_type") + " " + r.get("what_id") + " " + r.get("status"))
                .containsExactly("document n-obs available");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(DISTINCT obs_id) = count(*) AND bool_and(obs_id ~ '^obs:[0-9a-f]{64}$')"
                                        + " FROM observation",
                                Boolean.class))
                .isTrue();
    }

    @Test
    void 기사_태그는_활성_입력과_활성_카드_프로필로_기준을_넘은_카드만이다() throws Exception {
        // C1 · A3 승인본(card_version)이 있어야 카드 프로필을 넣을 수 있다
        jdbc.queryForObject(
                "SELECT set_config('issue_atlas.approver', ?, true)",
                String.class,
                "admin@seed.test");
        jdbc.execute(Files.readString(Path.of("db/seed/cards-c1-a3.sql")));
        profile("C1", "card-profile-v0", false);
        profile("C1", "card-profile-v1", true);
        profile("A3", "card-profile-v1", true);
        for (String id : List.of("n-both", "n-c1", "n-stale", "n-old-card", "n-none")) {
            article(id);
        }
        String both = input("n-both", "요약", true);
        score("n-both", both, "C1", "card-profile-v1", 0.8);
        score("n-both", both, "A3", "card-profile-v1", 0.75);
        String c1 = input("n-c1", "요약", true);
        score("n-c1", c1, "C1", "card-profile-v1", 0.8);
        score("n-c1", c1, "A3", "card-profile-v1", 0.6);
        // 요약이 바뀌어 새 입력이 활성이 됐는데 score 를 다시 돌리지 않았다
        score("n-stale", input("n-stale", "옛 요약", false), "C1", "card-profile-v1", 0.9);
        input("n-stale", "새 요약", true);
        // 카드 프로필이 바뀌기 전에 낸 점수
        score("n-old-card", input("n-old-card", "요약", true), "C1", "card-profile-v0", 0.9);
        input("n-none", "요약", true);

        assertThat(
                        jdbc.queryForList(
                                "SELECT what_id || ' ' || coalesce(nullif(array_to_string(tags, ','), ''), '-')"
                                        + " FROM observation WHERE source_table = 'news_event' ORDER BY what_id",
                                String.class))
                .containsExactly(
                        "n-both A3,C1", "n-c1 C1", "n-none -", "n-old-card -", "n-stale -");
    }

    /** 기사 한 건: 원본 · 사건 행. 원본 해시는 분류 입력이 가리킨다. */
    private void article(String newsId) {
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,collected_at)"
                        + " VALUES ('run-obs-SP01','SP01','https://bigkinds.or.kr',?,now())",
                "sha256:news-" + newsId);
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,time_precision,sido)"
                        + " VALUES (?,TIMESTAMPTZ '2024-01-09 00:00+09','day','전남광주통합특별시')",
                newsId);
    }

    /** 분류 입력 판 하나와 그 벡터. 돌려주는 값은 input_id. */
    private String input(String newsId, String text, boolean active) {
        String id =
                jdbc.queryForObject(
                        "SELECT 'dsi:' || encode(sha256(convert_to(?, 'UTF8')), 'hex')",
                        String.class,
                        newsId + "|" + text);
        jdbc.update(
                "INSERT INTO document_search_input(input_id,doc_id,news_id,raw_content_hash,input_version,"
                        + "input_text,input_hash) VALUES (?,'news:' || ?,?,?,'news-title-summary-v1',?,"
                        + "encode(sha256(convert_to(?, 'UTF8')), 'hex'))",
                id,
                newsId,
                newsId,
                "sha256:news-" + newsId,
                text,
                text);
        jdbc.update(
                "INSERT INTO document_embedding_v1(input_id,doc_id,model,embedding,is_active)"
                        + " VALUES (?,'news:' || ?,'gemini-embedding-2',"
                        + "array_fill(0.01::real, ARRAY[1536])::vector,?)",
                id,
                newsId,
                active);
        return id;
    }

    private void profile(String card, String version, boolean active) {
        jdbc.update(
                "INSERT INTO card_search_profile(card_id,card_version,profile_version,profile_text,"
                        + "profile_hash,model,embedding,is_active)"
                        + " SELECT card_id, current_version, ?, '이슈: ' || name,"
                        + " encode(sha256(convert_to(card_id || ?, 'UTF8')), 'hex'), 'gemini-embedding-2',"
                        + " array_fill(0.01::real, ARRAY[1536])::vector, ? FROM card WHERE card_id = ?",
                version,
                version,
                active,
                card);
    }

    private void score(String newsId, String inputId, String card, String profile, double sim) {
        jdbc.update(
                "INSERT INTO document_card_score(doc_id,card_id,input_id,card_version,profile_version,model,"
                        + "cosine_similarity,threshold_version,threshold,selected)"
                        + " SELECT 'news:' || ?, card_id, ?, current_version, ?, 'gemini-embedding-2',"
                        + " ?, 'test', 0.7, ? >= 0.7 FROM card WHERE card_id = ?",
                newsId,
                inputId,
                profile,
                sim,
                sim,
                card);
    }

    private void stat(String spec, String indicator, String code, String locator) {
        String hash = "sha256:" + spec + code + locator;
        jdbc.update(
                "INSERT INTO raw_record(job_run_id,spec_id,raw_url,content_hash,collected_at)"
                        + " VALUES (?,?,'https://kosis.kr',?,now())",
                "run-obs-" + spec,
                spec,
                hash);
        jdbc.update(
                "INSERT INTO normalized_record(content_hash,source_id,spec_id,indicator_id,place_code_system,"
                        + "place_code_raw,observed_period_type,observed_period_start,observed_period_end,value,unit,"
                        + "storage_scope,validation_status,issues,rule_version,obs_key,is_latest,record)"
                        + " VALUES (?,'S01',?,?,'kosis',?,'M',TIMESTAMPTZ '2024-01-01 00:00+09',"
                        + "TIMESTAMPTZ '2024-02-01 00:00+09',1,'명','full','pass','[]','p2-test',"
                        + "'obs:' || encode(sha256(convert_to(?, 'UTF8')), 'hex'),true,"
                        + "jsonb_build_object('locator', ?::jsonb))",
                hash,
                spec,
                indicator,
                code,
                hash,
                locator);
    }

    private static Map<String, Object> row(
            String type,
            String id,
            String place,
            String to,
            String station,
            String tag,
            String status) {
        return Map.of(
                "what_type", type,
                "what_id", id,
                "place_id", place,
                "to_place", to,
                "station", station,
                "tag", tag,
                "status", status);
    }
}
