package com.c108.issueatlas.place;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0020 기사 지역 배열 {@code news_event.regions} 와 contracts/p3 「지역 맞추기」 쿼리를 확인한다. StationPlaceSeedTest
 * 와 같은 이유로 {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NewsEventRegionsTest {
    private static final String SIDO = "전남광주통합특별시";

    // contracts/p3 README 「지역 맞추기」와 같은 쿼리
    private static final String MATCH_NEWS =
            """
            SELECT e.news_id
            FROM news_event e
            JOIN place p ON p.place_id = ?
            WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(e.regions) r
                WHERE r ->> 'sido' = p.attrs ->> 'sido'
                  AND (r ->> 'sigun' IS NULL OR r ->> 'sigun' = p.attrs ->> 'sigun')
                  AND (r ->> 'gu' IS NULL OR r ->> 'gu' = p.attrs ->> 'gu'))
            ORDER BY e.news_id
            """;

    private static final List<String> GWANGJU_GU =
            List.of(
                    "plc_gwangju_donggu",
                    "plc_gwangju_seogu",
                    "plc_gwangju_namgu",
                    "plc_gwangju_bukgu",
                    "plc_gwangju_gwangsangu");

    @Autowired JdbcTemplate jdbc;

    @Test
    void 지역_배열은_기본이_빈_배열이고_배열이_아니면_거절한다() {
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,time_precision,sido)"
                        + " VALUES ('r-default',TIMESTAMPTZ '2023-01-09 00:00:00+09','published',?)",
                SIDO);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT regions = '[]'::jsonb FROM news_event WHERE news_id = 'r-default'",
                                Boolean.class))
                .isTrue();
        assertThatThrownBy(() -> news("r-object", SIDO, null, null, "{}"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 기사는_지역_원소_하나라도_맞으면_나온다() {
        news(
                "r1-yeosu-suncheon",
                SIDO,
                "여수시",
                null,
                "[" + region(SIDO, "여수시", null) + "," + region(SIDO, "순천시", null) + "]");
        news(
                "r2-donggu-bukgu",
                SIDO,
                "광주",
                "동구",
                "[" + region(SIDO, "광주", "동구") + "," + region(SIDO, "광주", "북구") + "]");
        news("r3-gwangju", SIDO, "광주", null, "[" + region(SIDO, "광주", null) + "]");
        news("r4-nation", "전국", null, null, "[" + region("전국", null, null) + "]");

        assertThat(match("plc_yeosu")).containsExactly("r1-yeosu-suncheon");
        assertThat(match("plc_gwangju_bukgu")).containsExactly("r2-donggu-bukgu", "r3-gwangju");
        assertThat(match("plc_gwangju_seogu")).containsExactly("r3-gwangju");
        // 광주(구 없음) 기사는 다섯 구 모두에, 전국 기사는 어디에도 나오지 않는다(시도가 다르다)
        for (String gu : GWANGJU_GU) {
            assertThat(match(gu)).contains("r3-gwangju").doesNotContain("r4-nation");
        }
    }

    private void news(String newsId, String sido, String sigun, String gu, String regions) {
        jdbc.update(
                "INSERT INTO news_event(news_id,event_start,time_precision,sido,sigun,gu,regions)"
                        + " VALUES (?,TIMESTAMPTZ '2023-01-09 00:00:00+09','published',?,?,?,CAST(? AS jsonb))",
                newsId,
                sido,
                sigun,
                gu,
                regions);
    }

    private static String region(String sido, String sigun, String gu) {
        return "{\"sido\": %s, \"sigun\": %s, \"gu\": %s}"
                .formatted(json(sido), json(sigun), json(gu));
    }

    private static String json(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    private List<String> match(String placeId) {
        return jdbc.queryForList(MATCH_NEWS, String.class, placeId);
    }
}
