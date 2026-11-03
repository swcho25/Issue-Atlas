package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.springframework.test.web.servlet.ResultMatcher;

final class ReviewContract {
    private ReviewContract() {}

    static ResultMatcher matches(String component) {
        return result -> {
            var json = new ObjectMapper();
            var doc = json.readTree(Path.of("../contracts/reviews/openapi.json").toFile());
            var schema = json.createObjectNode().put("$ref", "#/components/schemas/" + component);
            schema.set("components", doc.get("components"));
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
                    .as("Review %s response", component)
                    .isEmpty();
        };
    }
}
