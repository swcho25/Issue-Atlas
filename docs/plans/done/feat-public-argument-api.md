# feat/public-argument-api — 일반 사용자 C2 API 를 로그인 없이 (로그인 정책 A안)

- Jira: S15P31C108-208 · 11/6 데모 1번 · C2 `openapi.yaml` `security: []`
- MR 제목: feat: 일반 사용자 API 공개 정책 반영 (S15P31C108-208)

## 완료 조건
- [x] 로그인 없이 GET `/v1/places` · `/v1/places/{place_id}/cards` · `/v1/arguments/{run_id}` · `/v1/evidence/{evidence_id}` · `/v1/observations` · `/v1/sources`, POST `/v1/questions` 가 된다
- [x] POST `/v1/questions` 는 로그인 없이도 CSRF 토큰이 있어야 한다(없으면 403)
- [x] `/v1/admin/**` · `/v1/auth/me` · `/v1/review-requests` 는 그대로 로그인 필요
- [x] A안으로 진행한다 — 장성우 진행 지시(2026-11-04, Jira S15P31C108-208)

## 진행
- 2026-11-04: 결정 전에 미리 만듦. SecurityConfig 에 공개 경로 7개를 메서드까지 지정해 열고, 「로그인 없이는 401」 테스트 6개를 「로그인 없이도 조회된다」로 바꿈. 익명 질문(CSRF 없음 403 · 있음 201 → 논증 200) 테스트 추가

## 다음 할 일 / 범위 밖
- 익명 POST `/v1/questions` 는 누구나 DB 에 질문 · 실행 행을 쌓을 수 있다. 요청 수 제한(IP 또는 세션당 분당 N건)은 **논증 문장화(engine → GMS LLM) 연결 MR 보다 먼저** 넣는다 — 그 뒤로는 익명 질문 1건이 곧 GMS 토큰 사용이다(!133 최동준 리뷰). 문장화 전이면 데모 뒤도 된다
- 프론트는 POST 전에 GET `/v1/auth/csrf` 로 `XSRF-TOKEN` 쿠키를 받고 `X-XSRF-TOKEN` 헤더로 보낸다
- B안(프론트 로그인 화면)으로 정해지면 이 브랜치는 버린다
