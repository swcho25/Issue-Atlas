package com.c108.issueatlas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * C2 계약(contracts/c2/openapi.yaml)의 엔드포인트가 실제 Swagger 문서(/v3/api-docs)에 모두 있는지 본다(FR-J1). 응답 모양은 각
 * API 테스트의 {@link C2Contract} 가 본다. 경로 변수 이름(evidence_id · evidenceId)은 URL 에 안 나오니 비교에서 뺀다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OpenApiContractTest {
    private static final Set<String> METHODS = Set.of("get", "post", "put", "patch", "delete");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    @SuppressWarnings("unchecked")
    void everyC2EndpointIsInSwagger() throws Exception {
        Map<String, Object> contract =
                new Yaml().load(Files.readString(C2Contract.DIR.resolve("openapi.yaml")));
        Set<String> expected = new TreeSet<>();
        ((Map<String, Map<String, Object>>) contract.get("paths"))
                .forEach(
                        (path, item) ->
                                item.keySet().stream()
                                        .filter(METHODS::contains)
                                        .forEach(m -> expected.add(operation(m, path))));

        JsonNode docs =
                json.readTree(
                        mvc.perform(get("/v3/api-docs"))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString());
        Set<String> actual = new TreeSet<>();
        docs.get("paths")
                .properties()
                .forEach(
                        p ->
                                p.getValue().properties().stream()
                                        .map(Map.Entry::getKey)
                                        .filter(METHODS::contains)
                                        .forEach(m -> actual.add(operation(m, p.getKey()))));

        assertThat(expected).hasSize(10);
        assertThat(actual).containsAll(expected);
    }

    private static String operation(String method, String path) {
        return method.toUpperCase() + " " + path;
    }
}
