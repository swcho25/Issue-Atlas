package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.springframework.test.web.servlet.ResultMatcher;

/** OpenAPI 3.1의 실제 component schema로 관리자 응답을 검사한다. */
final class C3Contract {
    private C3Contract() {}

    static ResultMatcher matches(String component) {
        return result -> {
            var json = new ObjectMapper();
            var document = json.readTree(Path.of("../contracts/c3/openapi.json").toFile());
            var schema = json.createObjectNode();
            schema.put("$ref", "#/components/schemas/" + component);
            schema.set("components", document.get("components"));
            var validator =
                    JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                            .getSchema(
                                    schema,
                                    SchemaValidatorsConfig.builder()
                                            .formatAssertionsEnabled(true)
                                            .build());
            assertThat(
                            validator.validate(
                                    json.readTree(
                                            result.getResponse()
                                                    .getContentAsString(StandardCharsets.UTF_8))))
                    .as("C3 %s response", component)
                    .isEmpty();
        };
    }
}
