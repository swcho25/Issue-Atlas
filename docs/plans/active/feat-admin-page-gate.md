# feat/admin-page-gate — 관리자 화면은 ADMIN 만, 띠 메뉴는 역할대로

- Jira: (미생성 — Atlassian 연결 뒤 「[S4] 관리자 화면 접근 구분 추가」) · PRD: FR-I6

## 완료 조건
- [x] `/admin` 아래 화면은 ADMIN 만 본다. 로그인이 없거나 VIEWER 면 랜딩(`/`)으로 보낸다 — `AdminLayout`(`AuthGate` 의 관리자 옵션)
- [x] `/admin` 에 첫 관리자 화면(운영 요약 자리)이 있어 관리자 로그인 뒤 이동(`homeOf`)이 404 가 아니다
- [x] 앱 화면의 왼쪽 띠가 로그인한 사람의 역할을 읽어 ADMIN 이면 관리 메뉴를 더 보인다
- [x] 계정 만드는 방식(첫 관리자 환경 변수 · 관리자 계정 API)은 그대로
- [x] lint · typecheck · test 통과, 브라우저에서 관리자 · 로그인 없음 두 경우 확인

## 진행
- 2026-11-05: 시작. 백엔드는 이미 `/v1/admin/**` = ADMIN(필터 체인 한 곳). 프론트는 `/admin` 화면이 없고, `AppLayout` 이 띠에 역할을 넘기지 않아 관리 메뉴가 안 보이며, `AuthLayout` 은 어디에도 안 쓰였다

- 2026-11-05: `AuthGate` 에 `admin` 옵션 + `AdminLayout`, `app/(app)/admin`(layout · 운영 요약 자리 page), `AppLayout` 의 `UserRail` 이 `/v1/auth/me` 로 띠 역할 · 이름을 넘김(오류면 조회자 띠). 테스트 11개(관리자 · 조회자 · 로그인 없음, 띠 역할) · lint(ESLint · steiger · prettier) · typecheck 통과
- 2026-11-05: 브라우저(로컬 프런트 → dev-backend): 로그인 없이 `/admin` → `/` 로 이동. `admin` 로그인 → `/admin` 「운영 요약」, 띠에 운영 요약 · 검수 · 카드 · 데이터 소스. 콘솔 오류 없음. VIEWER 는 개발 서버에 켜진 계정이 없어 단위 테스트로만 확인

## 다음 할 일 / 범위 밖
- 관리 메뉴의 검수 · 카드 · 데이터 소스 화면(`/admin/reviews` 등)은 각 화면 작업에서
