package com.c108.issueatlas.place;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * V0041 · V0042 경계를 C2 {@code place-boundaries} 로 읽는다. 좌표가 길어 예시와 통째로 비교하지 않고 스키마 · 순서 · 건수를 본다.
 * FoundationMigrationTest 는 place 를 비우므로 같은 컨텍스트(DB)를 쓰지 않게 {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PlaceBoundaryApiTest {
    @Autowired MockMvc mvc;

    @Test
    void 시군구를_주면_시군구_경계가_먼저_이어서_그_행정동() throws Exception {
        String body =
                mvc.perform(get("/v1/places/kr-12210/boundaries"))
                        .andExpect(status().isOk())
                        .andExpect(C2Contract.matches("place-boundaries"))
                        .andExpect(jsonPath("$.type").value("FeatureCollection"))
                        // 동구 1 + 행정동 13 (V0019)
                        .andExpect(jsonPath("$.features", hasSize(14)))
                        .andExpect(jsonPath("$.features[0].id").value("kr-12210"))
                        .andExpect(jsonPath("$.features[0].properties.level").value("sigungu"))
                        .andExpect(jsonPath("$.features[0].properties.parent_id").value("kr-29"))
                        .andExpect(jsonPath("$.features[0].geometry.type").value("MultiPolygon"))
                        .andExpect(jsonPath("$.features[1].id").value("kr-12210510"))
                        .andExpect(jsonPath("$.features[1].properties.name").value("충장동"))
                        .andExpect(
                                jsonPath("$.features[1].properties.source").value("sgis_hadmarea"))
                        .andExpect(jsonPath("$.features[1].properties.source_year").value(2025))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        // 좌표는 소수 5자리까지
        assertThat(body).doesNotContainPattern("\\d\\.\\d{6,}");
    }

    @Test
    void 여수시는_행정동_27곳까지_28개() throws Exception {
        mvc.perform(get("/v1/places/kr-12130/boundaries"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("place-boundaries"))
                .andExpect(jsonPath("$.features", hasSize(28)));
    }

    @Test
    void 행정동을_주면_그_행정동_하나() throws Exception {
        mvc.perform(get("/v1/places/kr-12210560/boundaries"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("place-boundaries"))
                .andExpect(jsonPath("$.features", hasSize(1)))
                .andExpect(jsonPath("$.features[0].properties.name").value("계림1동"))
                .andExpect(jsonPath("$.features[0].properties.parent_id").value("kr-12210"));
    }

    @Test
    void 경계가_없는_측정소_시도는_빈_목록() throws Exception {
        for (String placeId : new String[] {"kr-12130-s336121", "kr-29"}) {
            mvc.perform(get("/v1/places/" + placeId + "/boundaries"))
                    .andExpect(status().isOk())
                    .andExpect(C2Contract.matches("place-boundaries"))
                    .andExpect(jsonPath("$.features", hasSize(0)));
        }
    }

    @Test
    void 없는_지역은_404() throws Exception {
        mvc.perform(get("/v1/places/plc_nowhere/boundaries")).andExpect(status().isNotFound());
    }
}
