package com.c108.issueatlas.common.config;

import com.c108.issueatlas.common.exception.ApiErrorCode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import io.swagger.v3.core.jackson.ModelResolver;
import io.swagger.v3.core.jackson.TypeNameResolver;
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
import io.swagger.v3.oas.models.parameters.Parameter;
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
            describeRequestFields(api.getComponents());
            api.getPaths()
                    .forEach(
                            (path, item) ->
                                    item.readOperationsMap()
                                            .forEach(
                                                    (method, op) -> {
                                                        addErrors(path, method, op);
                                                        describeParameters(path, op);
                                                    }));
        };
    }

    /**
     * 요청 본문 칸 설명: 「스키마 이름.칸」 → 설명. 스키마 이름은 {@link NestedTypeNames} 가 정한 것(CardApprovalDto.Submit →
     * CardApprovalSubmit). 허용 값 · 길이는 Bean Validation 이 pattern · maxLength 로 따로 싣고, 여기는 뜻을 적는다.
     */
    private static final Map<String, String> REQUEST_FIELDS =
            Map.ofEntries(
                    Map.entry("QuestionCreateRequest.place_id", "질문 지역 ID (예 kr-12130 여수시)"),
                    Map.entry(
                            "QuestionCreateRequest.card_id",
                            "카드 ID (예 C1). null 이면 목록에 없는 질문 — 신규 카드 후보로 저장하고 판단하지 않는다"),
                    Map.entry("QuestionCreateRequest.period_start", "기간 시작 (포함, YYYY-MM-DD)"),
                    Map.entry("QuestionCreateRequest.period_end", "기간 끝 (미포함, YYYY-MM-DD, 시작보다 뒤)"),
                    Map.entry("QuestionCreateRequest.raw_text", "사용자가 입력한 질문 문장 (선택)"),
                    Map.entry("LoginRequest.email", "로그인 이메일"),
                    Map.entry("LoginRequest.password", "비밀번호. 틀려도 · 없는 계정이어도 · 비활성이어도 같은 401"),
                    Map.entry("CreateUserRequest.email", "로그인 이메일 (이미 있으면 409)"),
                    Map.entry("CreateUserRequest.password", "비밀번호 8–72자"),
                    Map.entry("CreateUserRequest.name", "표시 이름 50자까지"),
                    Map.entry(
                            "CreateUserRequest.role", "ADMIN(관리자 — /v1/admin/** 사용) · VIEWER(조회자)"),
                    Map.entry("UpdateUserRequest.is_active", "false 면 비활성(로그인 불가), true 면 다시 활성"),
                    Map.entry(
                            "CardStorageCreateCard.card_id", "새 카드 ID — 대문자 A–H + 숫자 1–3자리 (예 C2)"),
                    Map.entry("CardStorageCreateCard.name", "카드 이름 200자까지"),
                    Map.entry("CardStorageCreateCard.domain", "영역 100자까지 (예 인구 · 환경)"),
                    Map.entry("CardStorageCreateCard.parent_question", "카드가 답하는 상위 질문 500자까지"),
                    Map.entry(
                            "CardStorageSaveDraft.expected_revision",
                            "지금 초안 번호 (GET .../draft 의 draft_revision). 그사이 바뀌었으면 409"),
                    Map.entry(
                            "CardStorageSaveDraft.spec",
                            "카드 초안 전체 (카드 계약 contracts/cards 모양의 JSON 객체)"),
                    Map.entry(
                            "CardStorageApprove.expected_revision",
                            "승인할 초안 번호 (draft_revision). 그사이 바뀌었으면 409"),
                    Map.entry("CardStorageApprove.reason", "승인 사유 2000자까지"),
                    Map.entry(
                            "CardStorageSaveIndicator.expected_rule_version",
                            "지금 규칙 판 (처음 만들 때 0). 그사이 바뀌었으면 409"),
                    Map.entry(
                            "CardStorageSaveIndicator.definition",
                            "지표 정의 (JSON 객체 — 이름 · 단위 · 집계 방법)"),
                    Map.entry("CardStorageSaveIndicator.rule", "판정 규칙 (JSON, 선택). 바꾸면 규칙 판이 오른다"),
                    Map.entry("CardStorageSaveIndicator.numerator_id", "분자 지표 ID (선택)"),
                    Map.entry("CardStorageSaveIndicator.denominator_id", "분모 지표 ID (선택)"),
                    Map.entry("CardStorageSaveIndicator.base_id", "기준 지표 ID (선택)"),
                    Map.entry("CardStorageSaveIndicator.added_by_card", "이 지표를 추가한 카드 ID (선택)"),
                    Map.entry("CardStorageSaveIndicator.verified", "검증을 마쳤는가"),
                    Map.entry(
                            "CardApprovalSubmit.expected_revision",
                            "승인을 요청할 초안 번호 (GET .../draft 의 draft_revision). 그사이 바뀌었으면 409"),
                    Map.entry("CardApprovalSubmit.approver_id", "승인할 관리자 사용자 ID (활성 관리자여야 한다)"),
                    Map.entry("CardApprovalSubmit.reason", "요청 사유 2000자까지"),
                    Map.entry(
                            "CardApprovalDecide.expected_revision",
                            "처리할 요청 번호 (승인 요청 상세의 revision). 그사이 바뀌었으면 409"),
                    Map.entry(
                            "CardApprovalDecide.decision",
                            "approve(승인 → 카드 새 판) · reject(반려) · hold(보류). 지정된 승인자만 된다(아니면 403)"),
                    Map.entry("CardApprovalDecide.reason", "처리 사유 2000자까지"),
                    Map.entry(
                            "ReviewSubmit.target_type",
                            "대상 종류: news_event · normalized_record · source · card"),
                    Map.entry(
                            "ReviewSubmit.target_id",
                            "대상 ID — 기사 ID · 정제 행 ID(숫자) · 출처 ID · 카드 ID"),
                    Map.entry(
                            "ReviewSubmit.issue_type",
                            "문제 분류: location · classification · duplicate · value · wording · metadata · other"),
                    Map.entry("ReviewSubmit.card_id", "관련 카드 ID (선택, 예 C1)"),
                    Map.entry("ReviewSubmit.reason", "신고 · 등록 사유 2000자까지"),
                    Map.entry(
                            "ReviewSubmit.proposed_value",
                            "수정 제안 값 (선택, JSON 예 {place_id: kr-12130}). 보관만 하고 자료에 바로 반영하지 않는다"),
                    Map.entry(
                            "ReviewDecide.expected_revision",
                            "처리할 검수 번호 (검수 상세의 revision). 그사이 바뀌었으면 409"),
                    Map.entry(
                            "ReviewDecide.action",
                            "confirm(현재 값이 맞음) · correct(카드 초안 수정, scope=card 만) · hold(보류) · reject(반려)"),
                    Map.entry(
                            "ReviewDecide.scope", "처리 범위: record(그 자료) · source(출처 메타데이터) · card"),
                    Map.entry("ReviewDecide.reason", "처리 사유 2000자까지"),
                    Map.entry(
                            "ReviewDecide.expected_value",
                            "correct 때: 상세에서 조회한 현재 값 (그사이 바뀌었으면 409)"),
                    Map.entry("ReviewDecide.after", "correct 때: 바꿀 값 — 카드는 {draft_spec: 카드 초안 전체}"),
                    Map.entry(
                            "ReviewDecide.approver_id", "correct(카드) 때: 승인할 관리자 사용자 ID (본인 지정 가능)"),
                    Map.entry(
                            "CsvImportFinish.expected_revision",
                            "처리할 요청 번호 (가져오기 상세의 revision). 그사이 바뀌었으면 409"),
                    Map.entry("CsvImportFinish.status", "completed(반영 완료) · failed(반영 실패)"),
                    Map.entry("CsvImportFinish.reason", "처리 결과 설명 2000자까지"),
                    Map.entry("CsvImportFinish.loaded_rows", "반영한 행 수"),
                    Map.entry("CsvImportFinish.skipped_rows", "건너뛴 행 수"));

    private static void describeRequestFields(Components components) {
        REQUEST_FIELDS.forEach(
                (key, description) -> {
                    int dot = key.indexOf('.');
                    Schema<?> schema = components.getSchemas().get(key.substring(0, dot));
                    if (schema != null && schema.getProperties() != null) {
                        Schema<?> field = schema.getProperties().get(key.substring(dot + 1));
                        if (field != null && field.getDescription() == null) {
                            field.setDescription(description);
                        }
                    }
                });
    }

    /** 여러 API 가 같은 뜻으로 쓰는 파라미터 설명. 경로마다 뜻이 다른 id · status 는 {@link #PATH_PARAMETERS}. */
    private static final Map<String, String> PARAMETERS =
            Map.ofEntries(
                    Map.entry("page", "페이지 번호 (1부터, 기본 1)"),
                    Map.entry("size", "한 페이지 개수 (1–100, 기본 20)"),
                    Map.entry("from", "기간 시작 (포함, 오프셋 포함 ISO 8601 예 2026-11-01T00:00:00+09:00)"),
                    Map.entry("to", "기간 끝 (미포함, from 보다 뒤)"),
                    Map.entry("place_id", "지역 ID (예 kr-12130 여수시 · kr-12210 광주 동구)"),
                    Map.entry("card_id", "카드 ID (예 C1 청년 유출 · A3 대기질)"),
                    Map.entry("period_start", "질문 기간 시작 (포함, YYYY-MM-DD)"),
                    Map.entry("period_end", "질문 기간 끝 (미포함, YYYY-MM-DD)"),
                    Map.entry("question_id", "질문 ID (내 질문 목록 · 질문 저장 응답의 question_id)"),
                    Map.entry("run_id", "실행 ID (질문 저장 · 다시 실행 응답의 run_id)"),
                    Map.entry("evidence_id", "근거 ID (논증 응답 data 의 evidence_id)"),
                    Map.entry("job_run_id", "수집 실행 ID (수집 이력 목록의 job_run_id)"),
                    Map.entry("before_run_id", "비교할 앞 실행 ID (같은 지역 · 카드 · 기간)"),
                    Map.entry("after_run_id", "비교할 뒤 실행 ID (같은 지역 · 카드 · 기간)"),
                    Map.entry("source_id", "출처 ID (GET /v1/sources 의 source_id)"),
                    Map.entry("spec_id", "수집 명세 ID (GET /v1/sources 의 specs[].spec_id)"),
                    Map.entry("assignee_id", "담당 관리자 사용자 ID"),
                    Map.entry("approver_id", "승인자(관리자) 사용자 ID"),
                    Map.entry("requested_by", "요청한 관리자 사용자 ID"),
                    Map.entry("actor_id", "처리한 관리자 사용자 ID"),
                    Map.entry(
                            "target_type", "대상 종류: news_event · normalized_record · source · card"),
                    Map.entry(
                            "target_id",
                            "대상 ID — target_type 에 따라 기사 ID · 정제 행 ID(숫자) · 출처 ID · 카드 ID"),
                    Map.entry(
                            "issue_type",
                            "문제 분류: location · classification · duplicate · value · wording · metadata · other"),
                    Map.entry("origin", "등록 출처: user(사용자 수정 제안) · admin · local_import · model"),
                    Map.entry("q", "검색어 — 대상 ID · 사유에서 찾는다(대소문자 무시)"),
                    Map.entry("scope", "처리 범위: record · source · card"),
                    Map.entry(
                            "action", "처리: confirm · correct · hold · reject · approve(카드 최종 승인)"),
                    Map.entry("role", "역할 — 지금은 ADMIN 만 된다(다른 값은 400)"),
                    Map.entry("is_active", "활성 계정만 — 지금은 true 만 된다(false 는 400)"),
                    Map.entry("template_version", "CSV 양식 판 (GET /v1/admin/import-templates 의 판)"),
                    Map.entry(
                            "request_key",
                            "같은 업로드를 다시 보낼 때 같은 값을 쓰면 새로 만들지 않는 키 (영숫자 · _ · -, 128자까지)"),
                    Map.entry("version", "카드 판 번호"));

    /** 경로마다 뜻이 다른 파라미터: 「경로 앞부분|이름」 → 설명. */
    private static final Map<String, String> PATH_PARAMETERS =
            Map.ofEntries(
                    Map.entry(
                            "/v1/admin/indicators|id", "지표 ID (예 population_net_migration_19_39)"),
                    Map.entry("/v1/admin/cards|id", "카드 ID (예 C1)"),
                    Map.entry("/v1/admin/reviews|id", "검수 ID"),
                    Map.entry("/v1/admin/imports|id", "CSV 가져오기 요청 ID"),
                    Map.entry("/v1/admin/approval-requests|id", "승인 요청 ID"),
                    Map.entry(
                            "/v1/admin/changes|id",
                            "변경 이력 ID (review_change:<UUID> 또는 card_revision:<숫자>)"),
                    Map.entry("/v1/admin/users|id", "사용자 ID (숫자)"),
                    Map.entry(
                            "/v1/admin/reviews|status",
                            "검수 상태: pending · on_hold · resolved · rejected · approval_pending"),
                    Map.entry(
                            "/v1/admin/approval-requests|status",
                            "승인 요청 상태: pending · on_hold · approved · rejected"),
                    Map.entry(
                            "/v1/admin/imports|status",
                            "가져오기 상태: validation_failed · no_changes · pending · completed · failed"),
                    Map.entry("/v1/admin/jobs|status", "수집 상태: running · ok · failed · aborted"));

    /** 설명이 없는 파라미터에만 위 표의 설명을 넣는다(컨트롤러에 @Parameter 로 적은 것이 먼저). */
    private static void describeParameters(String path, Operation op) {
        if (op.getParameters() == null) {
            return;
        }
        for (Parameter parameter : op.getParameters()) {
            if (parameter.getDescription() != null && !parameter.getDescription().isBlank()) {
                continue;
            }
            String name = parameter.getName();
            String description = PARAMETERS.get(name);
            for (Map.Entry<String, String> e : PATH_PARAMETERS.entrySet()) {
                String[] key = e.getKey().split("\\|");
                if (key[1].equals(name) && path.startsWith(key[0])) {
                    description = e.getValue();
                }
            }
            parameter.setDescription(description);
        }
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
                Json.mapper().copy().setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE),
                new NestedTypeNames());
    }

    /**
     * 안쪽 record 이름이 여러 DTO 에서 겹친다(Submit · Decide · Request · Page …). swagger-core 는 이름만 보고 한 스키마로
     * 합쳐 카드 승인 요청 본문에 검수 칸이 보이는 식으로 틀리게 나오므로, 바깥 클래스 이름을 앞에 붙인다(CardApprovalDto.Submit →
     * CardApprovalSubmit, ReviewDto.Submit → ReviewSubmit).
     */
    static final class NestedTypeNames extends TypeNameResolver {
        @Override
        protected String getNameOfClass(Class<?> cls) {
            Class<?> outer = cls.getEnclosingClass();
            String name = super.getNameOfClass(cls);
            return outer == null ? name : outer.getSimpleName().replaceFirst("Dto$", "") + name;
        }
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
