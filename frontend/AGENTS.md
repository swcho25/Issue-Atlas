<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# frontend 규칙

Next.js 16(App Router) · TypeScript strict · Tailwind CSS 4 · Feature-Sliced Design · TanStack Query · Zod. 기술 선택의 이유는 `docs/frontend-architecture.md`, 사람용 설명은 `README.md`.

## 폴더
- `app/` — Next 라우팅만. `page.tsx` 는 `src/pages/<slice>` 를 다시 내보내기만 한다
- 왼쪽 띠가 있는 앱 화면은 `app/(app)/` 안에, 랜딩처럼 띠가 없는 화면은 그 밖에 둔다. 메뉴 주소는 `src/widgets/app-rail/model/menu.ts` 한 곳
- `pages/` — 비워 둔다(README 만). Next 가 `src/pages` 를 Pages Router 로 읽지 않게 막는 용도
- `src/` — FSD 레이어: `app` → `pages` → `widgets` → `features` → `entities` → `shared`

## FSD
- 위 레이어에서 아래 레이어로만 import 한다. 같은 레이어의 다른 슬라이스는 import 하지 않는다
- 슬라이스 밖에서는 `index.ts` 로만 가져온다. `@/` = `src/`
- 슬라이스는 실제로 쓰일 때 만든다. 쓰이지 않는 슬라이스는 steiger 가 에러로 막는다
- 한 곳에서만 쓰는 코드는 그 슬라이스 안에 둔다. 두 곳 이상에서 쓰이면 `entities`·`features` 로 옮긴다
- 라우팅은 Next App Router 만. React Router 를 넣지 않는다

## 서버 · 클라이언트
- 결과를 읽는 화면(논증 카드 결과, 근거 상세, 내 질문)은 서버 컴포넌트
- 지도(MapLibre) · 슬라이더 · 선택 UI 는 `"use client"`. MapLibre 는 서버에서 그리지 않는다
- Spring API 는 `@/shared/api` 로만 부른다. 서버 컴포넌트 `apiGet`(fetch — Next 캐시), 클라이언트 `browserGet` · `browserPost`(axios `browserHttp`, 같은 출처 `/api/*` → rewrites). `API_BASE_URL` 은 서버 전용. axios 를 화면에서 직접 만들지 않는다
- 로그인은 서버 세션 쿠키(JSESSIONID, HttpOnly) + CSRF. 쓰기 요청의 `X-XSRF-TOKEN` 은 `browserHttp` 인터셉터가 넣는다. 로그인이 필요한 화면 묶음은 `src/app/layouts` 의 `AuthLayout`(없으면 `/` 로)

## 데이터
- 응답은 항상 Zod 스키마로 검증한다(`apiGet`·`browserGet` 둘째 인자). 스키마는 슬라이스 `model/schema.ts`, 타입은 `z.infer`
- 단, C2 계약 응답(여러 화면이 함께 쓰는 것, 예: `argumentSchema`)은 `src/shared/api/c2/` 에 `contracts/c2/schemas` 와 같은 칸으로 두고 `@/shared/api` 로 가져온다. 계약 예시(`contracts/c2/examples`)로 테스트한다
- 클라이언트 데이터는 TanStack Query. 쿼리는 슬라이스 `api/` 에 `queryOptions(...)` 로 정의하고 컴포넌트는 `useQuery(그 옵션)`
- 서버 상태를 `useState`·전역 스토어에 복사하지 않는다

## 스타일
- 디자인 기준은 `docs/design/DESIGN.md`(Figma v5). 값이 다르면 Figma 를 따른다
- **Tailwind 설정 파일은 `src/app/styles/globals.css`** 다(Tailwind 4 라 `tailwind.config.js` 가 없고, 만들지 않는다). UI 를 만들기 전에 이 파일 맨 위 목차와 토큰을 먼저 읽는다
- Tailwind 유틸리티 우선. 색·글꼴은 `src/app/styles/globals.css` 의 토큰(`bg-surface-1` · `text-text-2` · `border-border-1` 등, Figma 변수 IA v5 이름)으로만
- 토큰 밖 값(`bg-[#…]` · `text-[13px]` · `shadow-[…]` · `z-10` · `style` 의 `#…`)은 ESLint 가 막는다. 오류 문구대로 토큰으로 바꾼다. `eslint-disable` 로 피하지 않는다
- 색 토큰은 `light-dark()` 로 다크 값을 이미 갖는다. 토큰 색에 `dark:` 를 덧붙이지 않는다. 하드코딩 색을 쓰지 않는다
- 앰버(누르는 것 · 고른 것)는 `bg-primary`, 투명도는 `bg-text-1/7` · `bg-white/20` 처럼 `/숫자`. Tailwind 기본 색(`bg-blue-500` …)은 지워 두어 쓰면 안 먹는다(`white` · `black` 만 남김)
- 글자는 Figma 글자 스타일 `IA5/` 이름(`text-body-14` · `text-label-13` …, 크기 · 줄 높이 · 자간 · 굵기를 함께 건다), 모서리는 `rounded-sm|md|lg|xl|2xl|full`. Tailwind 기본 `text-sm` · `rounded-3xl` 등은 지워 두어 쓰면 스타일이 안 먹는다
- 그림자는 `shadow-xs|sm|md|drawer|frame`(Figma IA/Shadow) · `shadow-card`(결과 카드) · `shadow-legend`(범례) · `shadow-button|button-soft`(버튼)만. 기본 `shadow-lg` 등은 지웠다
- 유리는 `glass`(+ 채움 `glass-strong` · `glass-thin`)로, 지도 · 지구처럼 아래에 볼 것이 있을 때만 쓴다. 흰 화면 위 버튼에는 쓰지 않는다
- 겹침 순서는 숫자(`z-10`) 대신 `z-map` < `z-control` < `z-panel` < `z-popover` < `z-toast` < `z-modal`
- 공통 컴포넌트(버튼 · 배지 · 탭 바 · 아이콘 · 로고) 목록과 쓰는 법은 `src/shared/ui/README.md`. 있는 것은 새로 만들지 않고, 아이콘 SVG 를 화면 파일에 직접 쓰지 않는다(`Icon`)
- 견본은 개발 서버의 `/dev/ui`. 토큰 · 공통 컴포넌트를 바꾸면 여기서 Figma 와 비교한다. Figma 화면 · 컴포넌트를 만들 때 순서는 `ui` 스킬
- 다크 전환은 페이지 전체(`<html data-theme>`)로만 된다. 요소 하나에 `color-scheme`·`scheme-dark` 를 걸어도 토큰 색은 안 바뀐다

## 테스트
- 작성·실행은 `test` 스킬. 단위(스키마·변환)·컴포넌트(상태 있는 것만)는 필요할 때, 페이지(Playwright)는 페이지 완성 시 1~3개
- 테스트 파일은 대상 옆 `*.test.ts(x)`, 페이지 테스트는 `e2e/`. 도구는 `@/shared/lib/test`(`renderWithQuery`, `mswServer`) — 앱 코드에서 import 하지 않는다
- 스냅샷 테스트를 쓰지 않는다. 테스트를 통과시키려고 기대값을 바꾸거나 skip 하지 않는다
- 백엔드에 아직 없는 결과 화면은 목 API(`mocks/api-server.ts`, `pnpm --filter frontend mock:api`)로 띄워 본다. 가짜 응답은 손으로 만들지 않고 `contracts/c2/examples` 만 쓴다

## 검사 (루트에서)
`pnpm frontend:lint`(ESLint + steiger + prettier) · `pnpm frontend:typecheck` · `pnpm frontend:test` · `pnpm frontend:e2e`(빌드 포함)

포맷은 Prettier(`.prettierrc.json`, Tailwind 클래스 정렬 포함). Claude 는 편집 후 훅이 자동으로 맞추고, Codex·사람은 `pnpm --filter frontend format`
