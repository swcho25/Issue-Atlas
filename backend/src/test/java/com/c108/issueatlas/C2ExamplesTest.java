package com.c108.issueatlas;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** contracts/c2/examples 의 예시마다 이름이 가장 길게 겹치는 스키마로 검사한다(예: argument-c1-ready → argument). */
class C2ExamplesTest {

    @Test
    void 모든_예시가_자기_스키마에_맞는다() throws IOException {
        List<String> schemas = names(C2Contract.DIR.resolve("schemas"), ".schema.json");
        List<String> examples = names(C2Contract.DIR.resolve("examples"), ".json");
        assertThat(examples).isNotEmpty();
        for (String example : examples) {
            String schema =
                    schemas.stream()
                            .filter(s -> example.equals(s) || example.startsWith(s + "-"))
                            .max(Comparator.comparingInt(String::length))
                            .orElseThrow(() -> new AssertionError(example + " 에 맞는 스키마가 없다"));
            C2Contract.assertMatches(
                    schema,
                    Files.readString(C2Contract.DIR.resolve("examples/" + example + ".json")));
        }
    }

    @Test
    void 계약에_없는_칸이나_틀린_등급은_실패한다() throws IOException {
        String ready = Files.readString(C2Contract.DIR.resolve("examples/argument-c1-ready.json"));
        // 점수 · 순위 칸은 어떤 응답에도 없다
        assertThat(C2Contract.violations("argument", ready.replaceFirst("\\{", "{\"score\": 1,")))
                .isNotEmpty();
        // 구성 값은 그대로 두고 등급만 바꾸면 규칙표(qualifier-0.1)에 걸린다
        assertThat(
                        C2Contract.violations(
                                "argument",
                                ready.replace("\"grade\": \"high\"", "\"grade\": \"low\"")))
                .isNotEmpty();
    }

    private static List<String> names(Path dir, String suffix) throws IOException {
        try (Stream<Path> files = Files.list(dir)) {
            return files.map(p -> p.getFileName().toString())
                    .filter(n -> n.endsWith(suffix))
                    .map(n -> n.substring(0, n.length() - suffix.length()))
                    .sorted()
                    .toList();
        }
    }
}
