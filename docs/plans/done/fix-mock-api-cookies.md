# fix/mock-api-cookies — 목 API 서버가 dev 로그인 쿠키를 넘기도록

- Jira: S15P31C108-285 · 묶음/단위: 개발 도구(목 API 서버)

## 완료 조건
- [x] 목 서버 프록시가 dev 응답의 Set-Cookie(XSRF-TOKEN · JSESSIONID)를 localhost 브라우저로 넘긴다(Domain · Secure 제거)
- [x] 목 서버로 띄운 개발 화면에서 로그인 → 결과 화면(로그인 필수)이 열린다

## 진행
- 2026-11-06: 시작 · 마무리. develop 에 「로그인 필수」가 들어온 뒤 목 서버로는 로그인이 안 됨 — 로그인 POST 가 403(CSRF 쿠키가 브라우저에 안 생김), 세션 쿠키도 안 남음. 프록시가 Content-Type 만 넘기고 Set-Cookie 를 빼먹어서. 쿠키를 넘기게 고친 뒤 GET /v1/auth/csrf → 브라우저에 XSRF-TOKEN 생김, 사용자 로그인 → /results/run_c1_yeosu_2023_2025 열림(관측 순서 확인 때)
- 2026-11-06: 마무리. Jira S15P31C108-285. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- 없음

