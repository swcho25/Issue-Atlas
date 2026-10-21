<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# frontend 규칙

Next.js 16(App Router) · TypeScript strict · Tailwind CSS 4 · Feature-Sliced Design. 사람용 설명은 `README.md`.

## 폴더
- `app/` — Next 라우팅만. `page.tsx` 는 `src/pages/<slice>` 를 다시 내보내기만 한다
- `pages/` — 비워 둔다(README 만). Next 가 `src/pages` 를 Pages Router 로 읽지 않게 막는 용도
- `src/` — FSD 레이어: `app` → `pages` → `widgets` → `features` → `entities` → `shared`

## FSD
- 위 레이어에서 아래 레이어로만 import 한다. 같은 레이어의 다른 슬라이스는 import 하지 않는다
- 슬라이스 밖에서는 `index.ts` 로만 가져온다. `@/` = `src/`
- 슬라이스는 실제로 쓰일 때 만든다. 쓰이지 않는 슬라이스는 steiger 가 에러로 막는다

## 서버 · 클라이언트
- 결과를 읽는 화면(논증 카드 결과, 근거 상세, 내 질문)은 서버 컴포넌트
- 지도(MapLibre) · 슬라이더 · 선택 UI 는 `"use client"`. MapLibre 는 서버에서 그리지 않는다
- Spring API 는 `@/shared/api` 로만 부른다. `API_BASE_URL` 은 서버 전용

## 스타일
- Tailwind 유틸리티 우선. 색·글꼴은 `src/app/styles/globals.css` 의 토큰(`bg-background` 등)으로만
- 다크 모드는 `dark:` 변형. 하드코딩 색을 쓰지 않는다

## 검사 (루트에서)
`pnpm frontend:lint`(ESLint + steiger) · `pnpm frontend:typecheck` · `pnpm frontend:build`
