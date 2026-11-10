package com.c108.issueatlas.evidence;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 근거는 판정(S15P31C108-133)이 만든다. 여기서는 C2 예시와 같은 값을 직접 넣어 확인한다. 같은 DB 를 쓰는 다른 테스트에 남지 않게 테스트마다 되돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EvidenceApiTest {
    private static final String KOSIS_URL =
            "https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1B26001";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        jdbc.update(
                "INSERT INTO source(source_id,name,org,license_type,storage_scope,reliability_grade) VALUES"
                        + " ('S-ev-kosis','국가데이터처 KOSIS','국가데이터처','KOSIS-활용약관','full','A'),"
                        + " ('S-ev-news','지역 언론 RSS','언론사','RSS-링크','link_only','C')");
        evidence(
                "ev_test_kosis",
                "statistics",
                "시군구/성/연령(5세)별 이동자수",
                "S-ev-kosis",
                "A",
                "full",
                null,
                "2023-01-01",
                "2026-01-01",
                "{\"tbl_id\": \"DT_1B26001\", \"C1\": \"46130\", \"prd_de\": [\"2023\", \"2024\", \"2025\"]}",
                "여수시 · 계 · 20–24세 · 순이동(명): 2023 −747 · 2024 −719 · 2025 −930",
                KOSIS_URL);
        evidence(
                "ev_test_month",
                "statistics",
                "월별 순이동",
                "S-ev-kosis",
                "A",
                "full",
                null,
                "2024-06-01",
                "2024-07-01",
                "{}",
                null,
                null);
        evidence(
                "ev_test_news",
                "documents",
                "청년 정착 기사",
                "S-ev-news",
                "C",
                "link_only",
                "2025-03-01T16:00:00Z",
                null,
                null,
                "{\"guid\": \"x\"}",
                null,
                "https://news.example/a");
    }

    @Test
    @WithMockUser
    void 근거_상세와_각주() throws Exception {
        mvc.perform(get("/v1/evidence/ev_test_kosis"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("evidence"))
                .andExpect(jsonPath("$.schema_version").value("c2-0.1"))
                .andExpect(jsonPath("$.kind").value("statistics"))
                .andExpect(jsonPath("$.source_name").value("국가데이터처 KOSIS"))
                .andExpect(jsonPath("$.source_grade").value("A"))
                .andExpect(jsonPath("$.license_type").value("KOSIS-활용약관"))
                .andExpect(jsonPath("$.period_start").value("2023-01-01"))
                .andExpect(jsonPath("$.period_end").value("2026-01-01"))
                .andExpect(jsonPath("$.observed_at").value(nullValue()))
                .andExpect(jsonPath("$.locator.tbl_id").value("DT_1B26001"))
                .andExpect(jsonPath("$.locator.prd_de[2]").value("2025"))
                .andExpect(jsonPath("$.url").value(KOSIS_URL))
                .andExpect(
                        jsonPath("$.footnote")
                                .value(
                                        "국가데이터처 KOSIS · 시군구/성/연령(5세)별 이동자수 · 2023–2025 · 출처 등급 A · "
                                                + KOSIS_URL
                                                + " · 조회일 2026-10-21"));
        // 월 기간, URL 없음 → URL 칸을 빼고 「2024-06」
        mvc.perform(get("/v1/evidence/ev_test_month"))
                .andExpect(C2Contract.matches("evidence"))
                .andExpect(
                        jsonPath("$.footnote")
                                .value(
                                        "국가데이터처 KOSIS · 월별 순이동 · 2024-06 · 출처 등급 A · 조회일 2026-10-21"));
        // 링크만 저장한 근거는 내용을 보여 주지 않는다. 시점은 한국 날짜(UTC 16시 → 다음 날)
        mvc.perform(get("/v1/evidence/ev_test_news"))
                .andExpect(C2Contract.matches("evidence"))
                .andExpect(jsonPath("$.storage_scope").value("link_only"))
                .andExpect(jsonPath("$.display").value(nullValue()))
                .andExpect(
                        jsonPath("$.footnote")
                                .value(
                                        "지역 언론 RSS · 청년 정착 기사 · 2025-03-02 · 출처 등급 C ·"
                                                + " https://news.example/a · 조회일 2026-10-21"));
    }

    @Test
    void 링크만_저장한_근거에는_내용을_넣을_수_없다() {
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE evidence SET display = 'x' WHERE evidence_id = 'ev_test_news'"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @WithMockUser
    void 없는_근거는_404() throws Exception {
        mvc.perform(get("/v1/evidence/ev_test_none")).andExpect(status().isNotFound());
    }

    @Test
    void 로그인_없이도_조회된다() throws Exception {
        mvc.perform(get("/v1/evidence/ev_test_kosis")).andExpect(status().isOk());
    }

    private void evidence(
            String id,
            String kind,
            String title,
            String sourceId,
            String grade,
            String scope,
            String observedAt,
            String start,
            String end,
            String locator,
            String display,
            String url) {
        jdbc.update(
                "INSERT INTO evidence(evidence_id,kind,title,source_id,source_grade,license_type,storage_scope,"
                        + "observed_at,period_start,period_end,published_at,collected_at,location_precision,"
                        + "locator,display,url) SELECT ?,?,?,?,?,license_type,?,CAST(? AS timestamptz),"
                        + "CAST(? AS date),CAST(? AS date),NULL,TIMESTAMPTZ '2026-10-21 11:00:00+09','none',"
                        + "CAST(? AS jsonb),?,? FROM source WHERE source_id = ?",
                id,
                kind,
                title,
                sourceId,
                grade,
                scope,
                observedAt,
                start,
                end,
                locator,
                display,
                url,
                sourceId);
    }
}
