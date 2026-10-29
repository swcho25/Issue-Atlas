package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** Flyway 실제 적용 + 보안 필터 + SQL + HTTP 응답. 각 테스트 자료는 롤백한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PlaceCardsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seedPlace() {
        jdbc.update(
                "INSERT INTO place(place_id,name,level) VALUES ('cards-test', '여수시', 'sigungu')");
        jdbc.update(
                "INSERT INTO place(place_id,name,level) VALUES ('cards-other', '북구', 'sigungu')");
    }

    @Test
    void seededCardsHaveFourMissingKindsAndNoScores() throws Exception {
        String response =
                mvc.perform(request("cards-test", "2023-01-01", "2026-01-01"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.schema_version").value("c2-0.1"))
                        .andExpect(jsonPath("$.place_id").value("cards-test"))
                        .andExpect(jsonPath("$.period_end").value("2026-01-01"))
                        .andExpect(jsonPath("$.taxonomy_version").value("tax-2026.10"))
                        .andExpect(jsonPath("$.cards.length()").value(2))
                        .andExpect(jsonPath("$.cards[0].card_id").value("A3"))
                        .andExpect(jsonPath("$.cards[1].card_id").value("C1"))
                        .andExpect(jsonPath("$.cards[0].evidence.length()").value(4))
                        .andExpect(jsonPath("$.cards[0].evidence[0].kind").value("statistics"))
                        .andExpect(jsonPath("$.cards[0].evidence[3].kind").value("denominators"))
                        .andExpect(jsonPath("$.cards[0].available_kinds").value(0))
                        .andExpect(jsonPath("$.cards[0].review_pending_count").value(0))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        assertThat(response).doesNotContain("\"score\"", "\"rank\"", "\"availableKinds\"");
        // 실제 HTTP 응답을 C2 JSON Schema로 별도 검증하는 산출물.
        Files.createDirectories(Path.of("build"));
        Files.writeString(Path.of("build/c2-place-cards-response.json"), response);
    }

    @Test
    void countsKindsAndReviewItemsWithoutLeakingAnotherPlacePeriodOrVersion() throws Exception {
        put("cards-test", "C1", 1, "2023-01-01", "2026-01-01", "statistics", "available", 0);
        put("cards-test", "C1", 1, "2023-01-01", "2026-01-01", "documents", "review_pending", 3);
        put(
                "cards-test",
                "C1",
                1,
                "2023-01-01",
                "2026-01-01",
                "existing_responses",
                "license_blocked",
                0);
        put("cards-test", "C1", 1, "2023-01-01", "2026-01-01", "denominators", "not_published", 0);
        put("cards-other", "A3", 1, "2023-01-01", "2026-01-01", "statistics", "available", 0);
        put("cards-test", "A3", 1, "2024-01-01", "2025-01-01", "statistics", "available", 0);
        put("cards-test", "A3", 0, "2023-01-01", "2026-01-01", "documents", "available", 0);
        mvc.perform(request("cards-test", "2023-01-01", "2026-01-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].available_kinds").value(0))
                .andExpect(jsonPath("$.cards[1].available_kinds").value(1))
                .andExpect(jsonPath("$.cards[1].review_pending_count").value(3))
                .andExpect(jsonPath("$.cards[1].evidence[1].status").value("review_pending"))
                .andExpect(jsonPath("$.cards[1].evidence[2].status").value("license_blocked"))
                .andExpect(jsonPath("$.cards[1].evidence[3].status").value("not_published"));
    }

    @Test
    void sortsKoreanNamesInsideDomainRatherThanByAvailability() throws Exception {
        jdbc.update("INSERT INTO card VALUES ('C9','고령화','C 인구·지역소멸','test',0,'tax-2026.10')");
        for (String kind :
                new String[] {"statistics", "documents", "existing_responses", "denominators"}) {
            put("cards-test", "C1", 1, "2023-01-01", "2026-01-01", kind, "available", 0);
        }
        mvc.perform(request("cards-test", "2023-01-01", "2026-01-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[1].card_id").value("C9"))
                .andExpect(jsonPath("$.cards[2].card_id").value("C1"))
                .andExpect(jsonPath("$.cards[2].available_kinds").value(4));
    }

    @Test
    void missingPlaceIs404AndInvalidPeriodsAre400() throws Exception {
        mvc.perform(request("missing", "2023-01-01", "2026-01-01"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        for (String end : new String[] {"2023-01-01", "2022-01-01", "bad", "2023-02-30"}) {
            mvc.perform(request("cards-test", "2023-01-01", end))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        mvc.perform(get("/v1/places/cards-test/cards").with(user("viewer")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(
                        get("/v1/places/cards-test/cards")
                                .param("period_start", "2023-01-01")
                                .param("period_end", "2026-01-01"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void databaseRejectsDuplicateState() {
        put("cards-test", "C1", 1, "2023-01-01", "2026-01-01", "statistics", "available", 0);
        assertThatThrownBy(
                        () ->
                                put(
                                        "cards-test",
                                        "C1",
                                        1,
                                        "2023-01-01",
                                        "2026-01-01",
                                        "statistics",
                                        "not_collected",
                                        0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private MockHttpServletRequestBuilder request(String place, String start, String end) {
        return get("/v1/places/{place}/cards", place)
                .with(user("viewer"))
                .param("period_start", start)
                .param("period_end", end);
    }

    private void put(
            String place,
            String card,
            int version,
            String start,
            String end,
            String kind,
            String state,
            int pending) {
        jdbc.update(
                """
                INSERT INTO card_evidence_status
                (place_id,card_id,card_version,period_start,period_end,kind,status,review_pending_count)
                VALUES (?,?,?,?::date,?::date,?,?,?)
                """,
                place,
                card,
                version,
                start,
                end,
                kind,
                state,
                pending);
    }
}
