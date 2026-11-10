# feat/axios-client — 브라우저 요청 axios · CSRF 인터셉터 · AuthLayout

- Jira: S15P31C108-256 · PRD: FR-I6 · 묶음/단위: 화면 공통 세팅

## 완료 조건
- [x] `axios` 설치(버전 고정)
- [x] 브라우저 요청(`browserGet` · `browserPost`)을 axios 인스턴스 `browserHttp` 로. 쓰는 쪽 코드는 그대로
- [x] 요청 인터셉터: 쓰기 요청에 CSRF 토큰(`XSRF-TOKEN` 쿠키 → `X-XSRF-TOKEN` 헤더, 없으면 `/v1/auth/csrf` 로 먼저 받음). 응답 인터셉터: 오류 → `ApiError`
- [x] 서버 `apiGet` 은 fetch 유지(Next 캐시)
- [x] `AuthLayout`(로그인 없으면 `/` 로) — 만들기만, 어느 화면에도 적용하지 않음
- [x] 테스트 · 하네스 문서(`frontend/AGENTS.md`, `docs/frontend-architecture.md`)

## 진행
- 2026-11-05: 시작. 백엔드 인증을 확인 — JWT 가 아니라 서버 세션 쿠키(JSESSIONID, HttpOnly, SameSite=Lax) + CSRF(`csrf.spa()`). 그래서 인터셉터가 넣는 「키」는 CSRF 토큰, 로그인 여부는 `GET /v1/auth/me`. 범위는 「브라우저만 axios」(사용자 결정, 서버는 Next 캐시 때문에 fetch)
- 2026-11-05: `axios` 최신 1.21.0 은 10/27 공개(2주 안 됨) → 1.20.0(8/26) 고정. 새 패키지 5개, 기존 lockfile 줄 변경 없음, MIT
- 2026-11-05: `shared/api/browser.ts`(axios + 인터셉터 2개), `client.ts` 는 `apiGet` · `ApiError` 만. `meSchema` 를 랜딩에서 `shared/api/auth.ts` 로 옮김(랜딩은 다시 내보내기). `app/layouts/AuthLayout.tsx` — Next 문서대로 `cookies()` 는 `<Suspense>` 안의 `AuthGate` 에서, 쿠키를 실어 `/v1/auth/me`, 401 · 403 → `redirect("/")`, 500 은 그대로 던짐. 기존 브라우저 요청 테스트 4개가 axios 로 바꾼 뒤에도 그대로 통과 + 새 테스트(읽기 요청엔 CSRF 없음, AuthGate 4개). `pnpm check` 통과(테스트 40)

- 2026-11-05: 마무리. Jira S15P31C108-256. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- 실제 백엔드로 로그인 흐름(csrf → login → me) 브라우저 확인 — 로컬 백엔드를 켜야 한다
- `AuthLayout` 적용 위치(관리자 · 내 질문 묶음)는 화면을 만들 때. 관리자 역할 확인(403 화면)은 그때 더한다
- 로그아웃(`POST /v1/auth/logout`) 버튼은 띠의 사용자 메뉴를 만들 때
