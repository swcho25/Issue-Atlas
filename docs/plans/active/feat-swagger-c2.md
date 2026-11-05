# feat/swagger-c2 — Swagger 에 C2 계약 요약 채우기

- Jira: S15P31C108-158 후속(API 5종 Swagger + 계약 테스트) · 기준: 5차 멘토링 회의록 표 2 장성우(11/13)

## 완료 조건
- [x] Swagger 칸 이름이 실제 JSON 과 같은 snake_case 다(Try it out 예시 그대로 보내도 400 이 아님)
- [x] 제목 · 설명에 계약 원본 위치 · 로그인 정책 · CSRF 쓰는 법 · 데모 흐름
- [x] C2 9개가 계약과 같은 태그 · 요약 · operationId. 논증 응답은 `ArgumentResponse` 모양
- [x] Try it out 의 POST 에 CSRF 헤더가 자동으로 붙는다
- [x] 계약 테스트가 operationId · snake_case 칸 이름까지 본다

## 진행
- 2026-11-04: swagger-core 는 Jackson 2 라 application.yml 의 SNAKE_CASE(Jackson 3)를 몰라 문서가 `placeId` 였다 → Jackson 2 SNAKE_CASE ModelResolver. 로컬(빈 DB, 8082)에서 Swagger 화면 확인: 예시 snake_case, `X-XSRF-TOKEN` 자동, 여수 C1 질문 201

## 다음 할 일 / 범위 밖
- 관리자 카드 · 검수 · 사용자 API 의 태그 · 요약은 각 담당이 채운다(지금은 컨트롤러 이름 태그)
- 응답 스키마 설명(칸마다 뜻)은 계약 `schemas/*.schema.json` 이 원본이라 Swagger 에 옮기지 않는다
