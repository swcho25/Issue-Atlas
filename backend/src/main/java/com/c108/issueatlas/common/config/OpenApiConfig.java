package com.c108.issueatlas.common.config;

import com.c108.issueatlas.common.exception.ApiErrorCode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import io.swagger.v3.core.jackson.ModelResolver;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.PathItem.HttpMethod;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.tags.Tag;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;

/**
 * Swagger(/swagger-ui.html) 문서. 계약 원본은 contracts/c2/openapi.yaml 이고 여기는 그 요약을 띄운다.
 *
 * <p>swagger-core 는 Jackson 2 로 칸 이름을 읽어 application.yml 의 SNAKE_CASE(Jackson 3)를 모른다. 그대로 두면 문서가
 * {@code placeId} 로 나와 「Try it out」 요청이 400 이 된다.
 */
@Configuration
public class OpenApiConfig {
    // ponytail: SecurityConfig 의 로그인 필요 경로(관리자 밖)를 손으로 옮겨 둔 것. 그쪽 공개 범위가 바뀌면 같이 고친다
    private static final Set<String> LOGIN_REQUIRED =
            Set.of(
                    "GET /v1/me/questions",
                    "POST /v1/questions/{question_id}/runs",
                    "GET /v1/auth/me",
                    "POST /v1/review-requests",
                    "POST /v1/auth/logout");

    /**
     * 모든 API 에 공통 오류 응답(application/problem+json, contracts/http-errors)을 단다. 컨트롤러마다 적지 않고 여기 한 곳에서
     * 경로 · 메서드로 정한다. 이미 적힌 코드는 그대로 둔다.
     */
    @Bean
    OpenApiCustomizer commonErrors() {
        return api -> {
            if (api.getComponents() == null) {
                api.setComponents(new Components());
            }
            api.getComponents().addSchemas("Problem", problemSchema());
            api.getPaths()
                    .forEach(
                            (path, item) ->
                                    item.readOperationsMap()
                                            .forEach((method, op) -> addErrors(path, method, op)));
        };
    }

    private static void addErrors(String path, HttpMethod method, Operation op) {
        boolean admin = path.startsWith("/v1/admin/");
        boolean write = method != HttpMethod.GET;
        error(op, path, "400", "요청 형식이나 값이 틀림 (INVALID_REQUEST, errors[] 에 칸별 이유)");
        if (admin || LOGIN_REQUIRED.contains(method + " " + path)) {
            error(op, path, "401", "로그인 필요 (UNAUTHORIZED)");
        }
        if (admin || write) {
            error(
                    op,
                    path,
                    "403",
                    admin
                            ? "관리자가 아님(조회자 포함) 또는 CSRF 토큰이 없거나 틀림 (FORBIDDEN)"
                            : "CSRF 토큰이 없거나 틀림 (FORBIDDEN)");
        }
        if (path.contains("{")) {
            error(op, path, "404", "없는 리소스 (RESOURCE_NOT_FOUND)");
        }
        if (method == HttpMethod.POST && path.equals("/v1/questions")) {
            error(op, path, "429", "분당 질문 한도 초과 (TOO_MANY_REQUESTS, Retry-After: 60)");
        }
        error(op, path, "500", "서버 오류 (INTERNAL_ERROR, 입력 오류 상세는 싣지 않는다)");
    }

    private static void error(Operation op, String path, String status, String description) {
        if (op.getResponses() == null) {
            op.setResponses(new ApiResponses());
        }
        op.getResponses()
                .putIfAbsent(
                        status,
                        new ApiResponse()
                                .description(description)
                                .content(
                                        new Content()
                                                .addMediaType(
                                                        "application/problem+json",
                                                        new MediaType()
                                                                .example(example(path, status))
                                                                .schema(
                                                                        new Schema<>()
                                                                                .$ref(
                                                                                        "#/components/schemas/Problem")))));
    }

    /** ApiExceptionHandler 가 실제로 내는 본문(상태마다 code · detail)과 같은 예시. */
    private static Map<String, Object> example(String path, String status) {
        int code = Integer.parseInt(status);
        ApiErrorCode error = ApiErrorCode.forStatus(code);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(
                "type",
                "urn:issue-atlas:error:" + error.name().toLowerCase(Locale.ROOT).replace('_', '-'));
        body.put("title", HttpStatus.valueOf(code).getReasonPhrase());
        body.put("status", code);
        body.put("detail", error.detail());
        body.put("instance", path);
        body.put("code", error.name());
        body.put(
                "errors",
                code == 400
                        ? List.of(Map.of("field", "period_start", "message", "올바른 값을 입력해 주세요."))
                        : List.of());
        return body;
    }

    /** contracts/c2/openapi.yaml 의 Problem 과 같은 모양. code 는 ApiErrorCode 그대로. */
    private static Schema<?> problemSchema() {
        return new ObjectSchema()
                .addProperty("type", new StringSchema())
                .addProperty("title", new StringSchema())
                .addProperty("status", new IntegerSchema())
                .addProperty("detail", new StringSchema())
                .addProperty("instance", new StringSchema())
                .addProperty(
                        "code",
                        new StringSchema()
                                ._enum(
                                        Arrays.stream(ApiErrorCode.values())
                                                .map(Enum::name)
                                                .toList()))
                .addProperty(
                        "errors",
                        new ArraySchema()
                                .items(
                                        new ObjectSchema()
                                                .addProperty("field", new StringSchema())
                                                .addProperty("message", new StringSchema())))
                .required(
                        List.of("type", "title", "status", "detail", "instance", "code", "errors"));
    }

    @Bean
    ModelResolver snakeCaseModels() {
        return new ModelResolver(
                Json.mapper()
                        .copy()
                        .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE));
    }

    @Bean
    OpenAPI issueAtlasOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Issue Atlas API (C2)")
                                .version("c2-0.1")
                                .description(
                                        """
                                        응답 계약 원본: `contracts/c2/openapi.yaml` · `schemas/*.schema.json` (11/4 동결). \
                                        오류는 `application/problem+json` (`contracts/http-errors`).

                                        - 일반 사용자 API(places · questions · arguments · evidence · observations · sources)는 로그인 없이 부른다. 내 질문(`GET /v1/me/questions`) · 다시 실행 · 수정 제안은 로그인 필요
                                        - POST 는 먼저 `GET /v1/auth/csrf` 로 `XSRF-TOKEN` 쿠키를 받고 `X-XSRF-TOKEN` 헤더로 보낸다 (이 화면의 Try it out 은 자동)
                                        - `/v1/admin/**` 는 `POST /v1/auth/login` 세션 + ADMIN. 조회자는 403
                                        - 데모 흐름: `POST /v1/questions` → `run_id` → `GET /v1/arguments/{run_id}`
                                        """))
                .tags(
                        List.of(
                                new Tag().name("places").description("지역과 지역별 카드 목록"),
                                new Tag().name("questions").description("질문 저장과 논증 카드"),
                                new Tag().name("evidence").description("근거 상세와 지도 점"),
                                new Tag().name("auth").description("로그인 · 로그아웃 · 내 정보"),
                                new Tag().name("admin").description("관리자 전용 (/v1/admin/**)")))
                // 로그아웃은 컨트롤러가 아니라 보안 필터(SecurityConfig logout)라 springdoc 이 못 찾는다. 문서에만 적는다
                .path(
                        "/v1/auth/logout",
                        new PathItem()
                                .post(
                                        new Operation()
                                                .addTagsItem("auth")
                                                .operationId("logout")
                                                .summary("로그아웃 (세션을 끝낸다, X-XSRF-TOKEN 필요)")
                                                .responses(
                                                        new ApiResponses()
                                                                .addApiResponse(
                                                                        "204",
                                                                        new ApiResponse()
                                                                                .description(
                                                                                        "로그아웃됨")))));
    }
}
