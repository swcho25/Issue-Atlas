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
 * C2 계약(contracts/c2/openapi.yaml)의 엔드포인트가 실제 Swagger 문서(/v3/api-docs)에 경로 · 메서드 · operationId 까지
 * 같게 있는지 본다(FR-J1). 응답 모양은 각 API 테스트의 {@link C2Contract} 가 본다.
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
        ((Map<String, Map<String, Map<String, Object>>>) contract.get("paths"))
                .forEach(
                        (path, item) ->
                                item.forEach(
                                        (m, op) -> {
                                            if (METHODS.contains(m)) {
                                                expected.add(
                                                        operation(m, path, op.get("operationId")));
                                            }
                                        }));

        Set<String> actual = new TreeSet<>();
        docs().get("paths")
                .properties()
                .forEach(
                        p ->
                                p.getValue().properties().stream()
                                        .filter(op -> METHODS.contains(op.getKey()))
                                        .forEach(
                                                op ->
                                                        actual.add(
                                                                operation(
                                                                        op.getKey(),
                                                                        p.getKey(),
                                                                        op.getValue()
                                                                                .path("operationId")
                                                                                .asString()))));

        assertThat(expected).hasSize(9);
        assertThat(actual).containsAll(expected);
    }

    /** 문서의 칸 이름이 실제 JSON(snake_case)과 같아야 Swagger 의 Try it out 요청이 400 이 안 난다. */
    @Test
    void schemaFieldsAreSnakeCase() throws Exception {
        Set<String> fields = new TreeSet<>();
        docs().at("/components/schemas/QuestionCreateRequest/properties")
                .propertyNames()
                .forEach(fields::add);

        assertThat(fields)
                .containsExactlyInAnyOrder(
                        "place_id", "card_id", "period_start", "period_end", "raw_text");
    }

    private JsonNode docs() throws Exception {
        return json.readTree(
                mvc.perform(get("/v3/api-docs"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    private static String operation(String method, String path, Object operationId) {
        return method.toUpperCase() + " " + path + " " + operationId;
    }
}
