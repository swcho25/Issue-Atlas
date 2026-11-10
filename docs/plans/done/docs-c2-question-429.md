# docs/c2-question-429 — C2 openapi 에 질문 429 적기

- Jira: S15P31C108-250 · 관련: S15P31C108-208(요청 수 제한 구현) · 닫은 MR !156

## 완료 조건
- [x] C2 `openapi.yaml` 의 POST `/v1/questions` 에 429(`Retry-After`, `TOO_MANY_REQUESTS`)가 있고 develop 의 `QuestionRateLimitFilter` 동작(IP 당 분당 10, `Retry-After: 60`)과 같다
- [x] `code` enum 에 `TOO_MANY_REQUESTS`(http-errors v0.3), redocly lint 통과

## 진행
- 2026-11-05: !156 으로 같은 제한을 컨트롤러에 따로 만들었으나 develop 에 `QuestionRateLimitFilter`(c684b48 · 8631eaa)가 먼저 들어가 중복 → !156 닫음. develop 에 없던 C2 openapi 429 문서화만 옮긴다
- 2026-11-05: 버린 차이 — 남은 초 계산 `Retry-After`, 관리자 제외. 필요하면 필터를 고치는 별도 작업

## 다음 할 일 / 범위 밖
- 원격 `security/question-rate-limit` 브랜치 삭제(!156 닫힘)
- 배포 뒤 dev-backend 에서 11번 연속 질문으로 429 확인 → `ENGINE_URL` 켜기(-243)
