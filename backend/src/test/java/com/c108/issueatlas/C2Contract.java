package com.c108.issueatlas;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.test.web.servlet.ResultMatcher;

/**
 * API 응답이 C2 계약(contracts/c2/schemas)과 같은지 본다(FR-J1). 스키마의 $id 주소를 저장소의 파일로 잇는다.
 *
 * <p>사용: {@code mvc.perform(...).andExpect(C2Contract.matches("place-list"))}
 */
public final class C2Contract {
    private static final String ID_BASE = "https://issue-atlas.c108/contracts/c2/";
    static final Path DIR = Path.of("../contracts/c2").toAbsolutePath().normalize();
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final JsonSchemaFactory FACTORY =
            JsonSchemaFactory.getInstance(
                    SpecVersion.VersionFlag.V202012,
                    builder ->
                            builder.schemaMappers(
                                    mappers ->
                                            mappers.mapPrefix(
                                                    ID_BASE, DIR.resolve("schemas").toUri() + "")));
    private static final SchemaValidatorsConfig CONFIG =
            SchemaValidatorsConfig.builder().formatAssertionsEnabled(true).build();

    private C2Contract() {}

    /** 응답 본문이 {@code <name>.schema.json} 에 맞는지. */
    public static ResultMatcher matches(String name) {
        return result ->
                assertMatches(
                        name, result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    public static void assertMatches(String name, String json) {
        Set<ValidationMessage> errors = violations(name, json);
        if (!errors.isEmpty()) {
            throw new AssertionError(
                    "C2 "
                            + name
                            + " 계약과 다르다:\n"
                            + errors.stream()
                                    .map(ValidationMessage::getMessage)
                                    .sorted()
                                    .collect(Collectors.joining("\n")));
        }
    }

    static Set<ValidationMessage> violations(String name, String json) {
        JsonSchema schema =
                FACTORY.getSchema(SchemaLocation.of(ID_BASE + name + ".schema.json"), CONFIG);
        try {
            JsonNode node = JSON.readTree(json);
            return schema.validate(node);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
