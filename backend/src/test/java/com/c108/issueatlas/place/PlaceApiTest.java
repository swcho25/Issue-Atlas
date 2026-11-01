package com.c108.issueatlas.place;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.c108.issueatlas.C2Contract;
import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;

/**
 * V0011 이 넣은 지역 6곳을 그대로 읽는다. FoundationMigrationTest 는 place 를 비우므로 같은 컨텍스트(DB)를 쓰지 않게
 * {@code @AutoConfigureMockMvc} 를 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PlaceApiTest {
    private static final Path EXAMPLE = Path.of("../contracts/c2/examples/place-list.json");
    private static final Path EMD_EXAMPLE =
            Path.of("../contracts/c2/examples/place-list-emd-donggu.json");

    @Autowired MockMvc mvc;

    @Test
    @WithMockUser
    void 지역_목록은_C2_예시와_같다() throws Exception {
        mvc.perform(get("/v1/places"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("place-list"))
                // STRICT: 순서 · 칸 수까지 같아야 한다 (6곳, 코드 12개)
                .andExpect(content().json(Files.readString(EXAMPLE), JsonCompareMode.STRICT));
    }

    @Test
    @WithMockUser
    void 시군구를_주면_그_행정동을_C2_예시대로() throws Exception {
        mvc.perform(get("/v1/places").param("parent_id", "plc_gwangju_donggu"))
                .andExpect(status().isOk())
                .andExpect(C2Contract.matches("place-list"))
                // V0019 동구 행정동 13곳, SGIS 코드 통합 전 · 뒤 두 줄씩
                .andExpect(content().json(Files.readString(EMD_EXAMPLE), JsonCompareMode.STRICT));
    }

    @Test
    @WithMockUser
    void 없는_지역의_행정동은_404() throws Exception {
        mvc.perform(get("/v1/places").param("parent_id", "plc_nowhere"))
                .andExpect(status().isNotFound());
    }

    @Test
    void 로그인_없이는_401() throws Exception {
        mvc.perform(get("/v1/places")).andExpect(status().isUnauthorized());
    }
}
