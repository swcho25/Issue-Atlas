package com.c108.issueatlas.observation;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
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
        for (String age : List.of("000", "1005", "1201", "1305", "1605", "9999")) {
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
                        "population_registered_39",
                        "population_registered_total");
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
                                "-",
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
                                "plc_stn_336121",
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
