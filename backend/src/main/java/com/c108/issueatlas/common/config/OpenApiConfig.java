package com.c108.issueatlas.common.config;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import io.swagger.v3.core.jackson.ModelResolver;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.tags.Tag;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger(/swagger-ui.html) 문서. 계약 원본은 contracts/c2/openapi.yaml 이고 여기는 그 요약을 띄운다.
 *
 * <p>swagger-core 는 Jackson 2 로 칸 이름을 읽어 application.yml 의 SNAKE_CASE(Jackson 3)를 모른다. 그대로 두면 문서가
 * {@code placeId} 로 나와 「Try it out」 요청이 400 이 된다.
 */
@Configuration
public class OpenApiConfig {

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

                                        - 일반 사용자 API(places · questions · arguments · evidence · observations · sources)는 로그인 없이 부른다. 내 질문 목록(`GET /v1/questions`)과 수정 제안은 로그인 필요
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
