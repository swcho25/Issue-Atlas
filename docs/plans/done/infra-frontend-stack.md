# infra/frontend-stack — 프론트엔드 기술 구조 확정 (TanStack Query · Zod · Vitest · Playwright)

- Jira: S15P31C108-65 · PRD: — · 묶음/단위: S1-17 (추정)

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `docs/frontend-architecture.md` 에 영역별 선택 · 이유 · 비교한 대안이 있다 (서버 데이터 TanStack Query, 검증 Zod, 라우팅 Next App Router(React Router 미사용 이유), 지도, 차트, 테스트) + 테스트 층 표(단위 · 컴포넌트 · API 가짜 응답 · 페이지)
- [x] TanStack Query Provider 와 Zod 로 응답을 검증하는 API 예시 1개가 동작하고, 단위 테스트(Zod 스키마)와 컴포넌트 테스트(MSW 응답으로 TanStack Query 컴포넌트)가 있다
- [x] Vitest 단위 테스트가 `pnpm frontend:test` 로 돌고 `pnpm check` 에 포함된다
- [x] Playwright E2E 가 랜딩 화면을 열어 확인하고 `pnpm frontend:e2e` 로 돌며 `pnpm check:all` 에 포함된다
- [x] 테스트 스킬(`.agents/skills/test` + Claude 연결 파일)로 바뀐 코드에 맞는 테스트 작성 · 실행이 자동화된다
- [x] `frontend/AGENTS.md` 반영, `pnpm check:all` 통과

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-21: 시작. 와이어프레임은 미확정이라 화면-슬라이스 매핑은 범위에서 뺌. React Router 는 Next App Router 와 겹쳐 쓰지 않기로 하고 문서에 이유를 남긴다
- 2026-10-21: 테스트 층 결정 — 페이지(Playwright)는 페이지 완성 시 1~3개만, 단위 · 컴포넌트는 필요할 때. Testing Library · MSW 추가. 스냅샷 테스트 쓰지 않음

- 2026-10-21: 구현. TanStack Query 5 · Zod 4 · Vitest 5 · Testing Library · MSW 3 · Playwright 1.64 설치. 예시는 랜딩의 서버 상태 배지(Zod 스키마 → queryOptions → useQuery)
  - 결정: 클라이언트는 같은 출처 `/api/*` → next.config rewrites → Spring (CORS·주소 노출 없음)
  - 결정: steiger 지적으로 한 곳에서만 쓰는 예시는 `entities` 가 아니라 `pages/landing` 안에, Provider 세그먼트 이름은 `app/query-client`
  - 막힘: MSW 3 에서 `onUnhandledRequest` → `onUnhandledFrame` 으로 바뀜(타입 오류로 발견)
  - 환경: Vitest 5 · jsdom 30 · MSW 3 가 Node 22.22+/24.15+ 요구 → engines · `.nvmrc`(24) · @types/node 24
  - 테스트: 단위 3 · 컴포넌트 3 · 페이지 1. `pnpm check:all` 통과(45초). 브라우저에서 실제 백엔드로 「서버 정상」 확인, 콘솔 오류 없음
- 2026-10-21: /review 반영 — 헤더 병합(Headers 인스턴스 유실) 수정, browserGet 서버 호출 시 명확한 오류, 배지 DOWN 은 「서버 점검 중」으로 분리. 테스트 +3 (client 단위 2, 배지 컴포넌트 1) → 총 9개, pnpm check 통과
- 2026-10-21: finish — check:all 통과(lint 5.5s · typecheck 2.5s · test 3.0s · e2e 10.9s · backend 2.2s, 백엔드는 변경 없어 캐시). 커밋 후 MR(→ develop)

## 다음 할 일 / 범위 밖
- (팀 공지) Node 24.15+ 필요, 처음 한 번 `pnpm --filter frontend exec playwright install chromium`
- (범위 밖) 차트 라이브러리 선택 — 와이어프레임 확정 뒤
- (범위 밖) MapLibre 설치 — 지도 작업 때
- (리뷰 보류) rewrite 를 `/api/:path*` 전체가 아니라 백엔드 API 접두어(예: `/v1/**`)로 좁히기 — C2 API 설계 때
- (리뷰 보류) `@/shared/lib/test` 를 앱 코드에서 import 못 하게 ESLint no-restricted-imports — 두 번 어기면
- (리뷰 확인) CI 이미지 node:24-bookworm-slim digest 가 Node 24.15+ 인지 — CI 켜기 전
- (하네스) `scripts/` 변경이 `pnpm check` 영역에 안 잡힘
- (하네스) `jira.md` 의 에픽 검색 JQL `issuetype = 에픽` 이 이 커넥터에서 결과 0건 — 키 범위·issuetype ID 로 고치기
