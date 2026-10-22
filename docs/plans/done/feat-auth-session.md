# feat/auth-session — 로그인·역할 2개 추가

- Jira: S15P31C108-XX (사용자가 생성 예정) · PRD: FR-I6 · 묶음/단위: P7-15

## 완료 조건

- [x] `app_user` 마이그레이션이 빈 DB 에서 적용되고 `pnpm backend:test` 가 통과한다
- [x] VIEWER 계정의 `/v1/admin/**` 요청이 403 `FORBIDDEN`(problem+json), 로그인 없는 `/v1/**` 요청이 401 `UNAUTHORIZED` 다
- [x] ADMIN 이 계정을 만들고 끌 수 있으며, 비밀번호는 BCrypt 해시로만 저장된다
- [x] 첫 관리자가 환경 변수로 한 번만 생성되고, 비밀번호가 저장소·로그에 남지 않는다
- [x] 기존 `ApiExceptionHandlerTest` 가 의도를 유지한 채 통과하고 `pnpm check` 가 통과한다
- [x] `contracts/http-errors/` 에 401·403 코드가 추가됐다

## 진행

- 2026-10-22: 시작. 지시서 `instruction_auth.md`(장성우) 기준. origin/develop(3b55cc7)에서 브랜치 생성. 마이그레이션은 `V0004` — core-schema(작업 폴더에서 V0002 사용 중)와 겹치지 않게. **core-schema 를 먼저 머지해야** 기존 로컬 DB 의 Flyway 순서 검증이 깨지지 않는다.
- 2026-10-22: 결정 — `SecurityConfig` 는 지시서의 `common/config` 대신 `auth/config` 에 둔다. common 이 user(UserDetails 조회)에 의존하면 ArchUnit 「기능 패키지 순환 금지」에 걸린다(user → common 예외 사용).
- 2026-10-22: 구현 — `spring-boot-starter-security`(+ security-test), `V0004__create_app_user.sql`, user 도메인(AppUser·Role·AppUserRepository·UserService·InitialAdminInitializer·AdminUserController `/v1/admin/users` POST·PATCH), auth 도메인(AppUserDetailsService·AuthService·AuthController `/v1/auth/csrf`·`login`·`me`, logout 은 필터 체인), `auth/config/SecurityConfig`. Jackson `SNAKE_CASE` 전역(C2 와 같게), 세션 쿠키 HttpOnly·SameSite=Lax·Secure(환경 변수).
- 2026-10-22: 결정 — 401·403 은 EntryPoint·AccessDeniedHandler 가 `handlerExceptionResolver` 로 넘겨 `ApiExceptionHandler` 가 만든다(problem+json 생성 코드 한 벌). 로그인 실패(없는 계정·비밀번호·비활성)는 구분 없이 401. 중복 이메일 409(HTTP_ERROR), 자기 자신 비활성화 400. CSRF 는 `csrf.spa()`, 로그인 전 `GET /v1/auth/csrf`(204)로 XSRF-TOKEN 쿠키를 받는다(마스킹된 토큰을 본문에 주지 않음).
- 2026-10-22: 지시서와 다르게 한 것 — 그 밖의 경로는 `denyAll` 대신 `authenticated`. denyAll 이면 로그인한 사용자도 없는 경로에서 404 대신 403 을 받는다.
- 2026-10-22: 테스트 — `AuthIntegrationTest` 10개(실제 필터 체인 + PostGIS): 로그인→me, 틀린 비밀번호 401, 로그인 없이 401, VIEWER→admin 403(계정 미생성 확인), 생성 시 `{bcrypt}` 해시·이메일 소문자, 중복 409, CSRF 없는 POST 403, 첫 관리자 1명(재실행 후에도), 자기 비활성화 400, 꺼진 계정 로그인 401. 기존 `ApiExceptionHandlerTest` 는 `@WithMockUser` + POST 에 `csrf()` 만 추가해 10개 그대로 통과. `TestcontainersConfiguration` 을 public 으로(다른 패키지 테스트에서 import). 결과: ArchitectureTest 6 · BackendApplicationTests 1 · AuthIntegrationTest 10 · ApiExceptionHandlerTest 10, 실패 0.
- 2026-10-22: 테스트 출력에서 첫 관리자 비밀번호 문자열 검색 — UTF-8·UTF-16 모두 없음. `pnpm check` PASS(backend format · backend test), `git diff --check` 통과. 변경 28개 파일 · 약 900줄(통합 테스트 위주)이라 권장 300줄 초과 — MR 본문에 적기.
- 2026-10-22: `contracts/http-errors/README.md` v0.2(401·403 추가, 보안 필터 오류도 같은 모양), `backend/AGENTS.md` 구조에 인증·관리자 경로 규칙 한 줄, `.env.example` 에 `ADMIN_EMAIL`·`ADMIN_PASSWORD`·`SESSION_COOKIE_SECURE`.
- 2026-10-22: finish — `pnpm check:all`: harness·backend format·frontend lint·typecheck·test PASS, frontend e2e FAIL(환경). 처음엔 3100 포트를 다른 프로젝트 컨테이너(booktown-v2 loki)가 써서 서버가 못 떴고, `E2E_PORT=3110` 으로 다시 돌리자 Playwright Chromium 이 이 PC 에 설치돼 있지 않아 테스트가 시작되지 않음. 이 MR 은 frontend 를 바꾸지 않음. e2e 실패로 check:all 이 멈춰 `pnpm backend:build` 를 따로 실행 → 통과.

## 다음 할 일 / 범위 밖

- 이 PC 에 Playwright Chromium 설치 후 `E2E_PORT=3110 pnpm check:all` 재확인 (`pnpm --filter frontend exec playwright install chromium`)
- Jira 이슈 키를 머리와 MR 제목에 채우기

- 커밋·push·MR 은 사람이 확인 후. MR 리뷰어: 조석원(P7-15 공동), 화면팀(정호성·정우현 — http-errors v0.2, CSRF·쿠키 사용법)
- **머지 순서**: core-schema(V0002~) 먼저, 이 MR(V0004) 다음

- 재시작 후 로그인 유지가 필요하면 Spring Session JDBC (세션 테이블은 Flyway 로)
- `/internal/**` 용 두 번째 필터 체인 + `X-Internal-Key` (FastAPI·Impact Engine)
- 배포 시 Swagger·actuator 공개 범위 재검토
- 화면팀: 서버 컴포넌트 `apiGet` 이 브라우저 쿠키를 Spring 으로 넘기도록, CSRF 헤더 이름 공유
- 조석원(P7-15 공동)과 관리자 화면 쪽 분담
- C2 MR(S15P31C108-77) 머지 후 `contracts/c2/openapi.yaml` 에 인증·계정 경로 추가
