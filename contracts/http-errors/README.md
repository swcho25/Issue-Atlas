# 공통 HTTP 오류 응답 v0.3 초안

주는 쪽: backend(P7) → 받는 쪽: frontend. C2 통합 전 받는 쪽 리뷰가 필요한 공통 오류 계약 초안이다. 성공 응답 구조는 별도 C2에서 정한다.

## 범위와 응답

Spring MVC가 처리하는 요청 오류와 Controller에서 발생한 예외에 적용한다. 응답 Content-Type은 `application/problem+json`이며 Spring의 RFC 9457 ProblemDetail을 사용한다. 보안 필터(Spring Security)가 막은 요청도 같은 처리기로 넘겨 같은 모양으로 응답한다(401·403). 서블릿 컨테이너 자체의 오류는 해당 기능을 구현할 때 별도 확인한다.

```json
{
  "type": "urn:issue-atlas:error:invalid-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "요청 형식이나 값을 확인해 주세요.",
  "instance": "/v1/example",
  "code": "INVALID_REQUEST",
  "errors": [{"field": "name", "message": "이름은 필수입니다."}]
}
```

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| type | string | 오류 코드별 고정 URI: urn:issue-atlas:error: 뒤에 code를 소문자·하이픈으로 변환한 값 |
| title | string | HTTP 상태에 해당하는 표준 제목. UI 분기는 이 값 대신 code 사용 |
| status | integer | 실제 HTTP 상태 코드와 동일 |
| detail | string | 클라이언트 안내 문구. 내부 예외 메시지를 그대로 사용하지 않음 |
| instance | string | 요청 경로. 쿼리 문자열 제외 |
| code | string | 아래 오류 코드 |
| errors | array | 입력 오류 목록. 해당 사항 없으면 빈 배열 |
| errors[].field | string | 요청 DTO 필드 경로, 객체 전체 오류는 $ |
| errors[].message | string | 입력 제약조건 안내 메시지 |

`errors`는 @Valid 요청 DTO의 검증 오류를 field·message 순으로 정렬한다. JSON 파싱·쿼리 타입·필수 파라미터 오류는 INVALID_REQUEST와 빈 errors를 반환한다. rejectedValue·본문 원문·스택·예외 클래스·쿼리 문자열은 응답에 추가하지 않는다. 검증 메시지에는 사용자 입력값을 삽입하지 않는다.

## 오류 코드

| HTTP 상태 | code | detail |
| --- | --- | --- |
| 400 | INVALID_REQUEST | 요청 형식이나 값을 확인해 주세요. |
| 401 | UNAUTHORIZED | 로그인이 필요합니다. |
| 403 | FORBIDDEN | 이 작업을 할 권한이 없습니다. |
| 404 | RESOURCE_NOT_FOUND | 요청한 리소스를 찾을 수 없습니다. |
| 429 | TOO_MANY_REQUESTS | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. |
| 500 및 MVC 5xx | INTERNAL_ERROR | 서버에서 요청을 처리하지 못했습니다. |
| 나머지 MVC 4xx | HTTP_ERROR | 요청을 처리할 수 없습니다. |

없는 업무 리소스는 ResourceNotFoundException을 사용한다. 예상하지 못한 예외는 500으로 처리하고 서버 로그에 기록한다. MVC 예외는 원래 상태와 헤더(예: 405의 Allow)를 보존한다. INTERNAL_ERROR에는 상세 입력 오류를 포함하지 않는다. 로그인 실패는 없는 계정·틀린 비밀번호·비활성 계정을 구분하지 않고 모두 401 UNAUTHORIZED다. CSRF 토큰이 없거나 틀린 요청은 403 FORBIDDEN이다. 질문 저장(POST /v1/questions)이 IP 당 분당 한도(기본 10, `QUESTIONS_PER_MINUTE`)를 넘으면 429 TOO_MANY_REQUESTS 와 `Retry-After: 60` 이다. 같은 리소스를 두 번 만들면 409(HTTP_ERROR)다. 새 업무 오류 코드는 이 계약과 웹 테스트를 함께 추가하고 받는 쪽 리뷰를 받는다.

## 사용

요청 DTO에는 Jakarta Validation 제약조건을 선언하고 Controller의 @RequestBody에 @Valid를 붙인다. JPA Entity를 직접 요청·응답 타입으로 쓰지 않는다. 서비스에서 찾을 수 없는 업무 리소스는 `orElseThrow(ResourceNotFoundException::new)`처럼 명시적으로 처리한다. 성공 응답은 공통 예외 처리기가 감싸거나 수정하지 않는다.

업무 API는 아직 없으며 테스트용 경로는 src/test의 fixture에만 존재한다. 실제 /v1 경로와 성공 DTO는 각 기능·C2 작업에서 구현한다.

## 검증

- `node scripts/gradle.mjs test --tests com.c108.issueatlas.common.exception.ApiExceptionHandlerTest`: DB 없이 웹 계층 확인.
- `pnpm check`: 변경 영역 검사와 PostGIS 통합 테스트(Docker 필요).
- `pnpm backend:build`: 전체 백엔드 빌드.

검증 범위: DTO 필드 오류, JSON 파싱 실패, 본문 누락, 쿼리 타입 오류·누락, 업무 리소스/경로 없음, 405 상태·Allow 헤더 보존, 500 정보 비노출, 성공 응답 유지.

참고: [Spring 오류 응답 공식 문서](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html).

## 변경 이력

- v0.1 (2026-10-21): 공통 오류 응답 초안, 프론트 리뷰 대기.
- v0.2 (2026-10-22): 401 UNAUTHORIZED·403 FORBIDDEN 추가. 보안 필터가 막은 요청도 같은 problem+json. 프론트 리뷰 필요.
- v0.3 (2026-11-04): 429 TOO_MANY_REQUESTS 추가. 익명 질문 저장의 IP 당 분당 한도(S15P31C108-208 후속). 프론트는 이 코드를 받으면 「잠시 후 다시」 안내.
