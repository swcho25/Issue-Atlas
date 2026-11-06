# feat/swagger-my-questions-mock — Swagger 설명 빈 API 채우기 · 공통 오류 응답 (내 질문 목은 -295 로 대체)

- Jira: (생성 대기 — Atlassian MCP 미인증) · PRD: FR-J1 · 묶음/단위: P7

## 완료 조건
- [x] Swagger(/v3/api-docs)의 모든 API 에 summary 가 있다(인증 · 관리자 33개 + 로그아웃). 빠지면 테스트가 실패한다
- [x] ~~`GET /v1/questions` 내 질문 목 API~~ — 뺐다: 정호성 님의 실제 구현 `GET /v1/me/questions`(S15P31C108-295)가 먼저 develop 에 들어왔다
- [x] backend format · test · build 통과, 개발 서버 대신 로컬 Swagger UI 에서 확인(bootTestRun — 로컬 DB 는 Flyway 검증 실패라 Testcontainers DB 로)

## 진행
- 2026-11-06: 계약 · 문서에 적힌 API 는 모두 구현돼 있다(C2 10개 포함). 화면 메뉴에 있지만 API 가 없는 것: 내 질문(`/me/questions`) · 관리자 카드 목록. 사람 결정으로 내 질문만 목으로
- 2026-11-06: 인증 · 관리자 33개 @Operation · @Tag, 로그아웃(보안 필터)은 OpenApiConfig 에 문서만. `everyOperationHasSummary` 테스트로 빠짐을 막는다. Swagger UI 48개 모두 설명 있음. redocly lint · backend check · build 통과
- 2026-11-06: 사람 요청으로 공통 오류 응답 추가 — `OpenApiConfig.commonErrors` 가 경로 · 메서드로 400 · 401 · 403 · 404 · 429 · 500(problem+json, 상태별 예시)을 단다. 잘못된 입력 81개를 전 엔드포인트에 보내 500 이 없는 것을 확인(임시 테스트, 커밋 안 함)
- 2026-11-06: develop 반영 때 -295(실제 내 질문 · 다시 실행 API)와 겹쳐 목(API · C2 스키마 · 예시 · 문서)을 모두 뺐다. Swagger 401 규칙을 `/v1/me/questions` · `POST /v1/questions/{question_id}/runs` 로 맞춤
- 2026-11-06: 사람 요청으로 파라미터 81개 · 요청 본문 칸 52개 설명(OpenApiConfig 표 + CSV file 만 @Parameter). 이름이 같은 안쪽 record(Submit · Decide · Request · Page · Detail · Validation · Feature · Properties)가 한 스키마로 합쳐져 카드 승인 요청에 검수 칸이 보이던 것을 바깥 클래스 이름을 붙여 나눔(NestedTypeNames). 응답 칸 설명은 계약(contracts/c2/schemas)에 두고 Swagger 에는 싣지 않음

## 다음 할 일 / 범위 밖
- `OpenApiConfig.LOGIN_REQUIRED` 는 SecurityConfig 공개 범위를 손으로 옮긴 것 — 공개 범위가 바뀌면 같이 고친다
- 관리자 카드 목록 API(`GET /v1/admin/cards`) — 관리자 카드 화면 만들 때
