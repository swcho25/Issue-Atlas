# feat/swagger-my-questions-mock — Swagger 설명 빈 API 채우기 · 내 질문 목록 목 API

- Jira: (생성 대기 — Atlassian MCP 미인증) · PRD: FR-J1 · 묶음/단위: P7

## 완료 조건
- [x] Swagger(/v3/api-docs)의 모든 API 에 summary 가 있다(인증 · 관리자 33개 + 로그아웃). 빠지면 테스트가 실패한다
- [x] `GET /v1/questions`(내 질문 목록) 목 API: 로그인하면 계약 예시와 같은 고정 3건, 로그인 없으면 401
- [x] C2 계약에 `listMyQuestions` · `question-list` 스키마 · 예시, README · 동결 문서 변경 이력
- [x] backend format · test · build 통과, 개발 서버 대신 로컬 Swagger UI 에서 확인(bootTestRun — 로컬 DB 는 Flyway 검증 실패라 Testcontainers DB 로)

## 진행
- 2026-11-06: 계약 · 문서에 적힌 API 는 모두 구현돼 있다(C2 10개 포함). 화면 메뉴에 있지만 API 가 없는 것: 내 질문(`/me/questions`) · 관리자 카드 목록. 사람 결정으로 내 질문만 목으로
- 2026-11-06: 인증 · 관리자 33개 @Operation · @Tag, 로그아웃(보안 필터)은 OpenApiConfig 에 문서만. `everyOperationHasSummary` 테스트로 빠짐을 막는다. Swagger UI 48개 모두 설명 있음. redocly lint · backend check · build 통과

## 다음 할 일 / 범위 밖
- 내 질문 실제 구현: `question` 에 작성자 칸(Flyway) · 로그인 사용자로 거르기 · 실행 결과에서 마지막 실행
- 관리자 카드 목록 API(`GET /v1/admin/cards`) — 관리자 카드 화면 만들 때
