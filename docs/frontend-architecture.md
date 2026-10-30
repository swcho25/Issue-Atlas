# 프론트엔드 기술 구조

- 기준: 2026-10-21 · Jira S15P31C108-65 · 대상 `frontend/`
- 화면 구성(와이어프레임)은 아직 확정 전이다. 이 문서는 **화면과 무관한 기술 선택**만 정한다.
- 바꾸려면 이 문서와 `frontend/AGENTS.md` 를 같은 MR 에서 고친다.

## 1. 한눈에

| 영역 | 선택 | 상태 |
| --- | --- | --- |
| 프레임워크 · 라우팅 | Next.js 16 App Router | 적용 |
| 폴더 구조 | Feature-Sliced Design + steiger 검사 | 적용 |
| 스타일 | Tailwind CSS 4 + CSS 변수 토큰 | 적용 |
| 서버 데이터 (클라이언트) | TanStack Query 5 | 적용 |
| 응답 검증 · 타입 | Zod 4 | 적용 |
| API 호출 경로 | 서버: Spring 직접 · 브라우저: 같은 출처 `/api/*` → Next rewrites → Spring | 적용 |
| 지도 | MapLibre GL JS | 결정 (설치는 지도 작업 때) |
| 차트 (시계열) | 미정 — 후보 비교만 | 화면 확정 뒤 |
| 테스트 | Vitest · Testing Library · MSW · Playwright | 적용 |

## 2. 선택과 이유

### 라우팅 — Next.js App Router (React Router 쓰지 않음)

- **이유**: Next 가 파일 기반 라우팅 · 레이아웃 · 서버 컴포넌트 · 코드 분할을 이미 맡는다. React Router 를 더하면 라우터가 둘이 되어 URL · 데이터 로딩 · 프리페치가 어긋난다.
- **대안**: React Router 7 (프레임워크 모드) — Vite 기반 SPA/SSR 이면 좋은 선택이지만 Next 위에 얹을 이유가 없다.
- **쓰는 법**: 화면 이동은 `next/link` · `useRouter`, URL 상태(지역 · 카드 · 기간)는 `useSearchParams`. 경로 타입은 `next typegen` 이 만든다.

### 서버 데이터 — TanStack Query

- **이유**: 작업 공간 화면은 선택 · 슬라이더에 따라 같은 데이터를 여러 번 다시 부른다. 캐시 · 중복 요청 제거 · 로딩/오류 상태 · 재시도를 직접 만들지 않는다.
- **대안**: SWR (기능이 적고 mutation · devtools 가 약함), 서버 컴포넌트만 사용 (상호작용 많은 작업 공간에 부적합).
- **나누는 기준**
  - 결과를 **읽기만** 하는 화면(논증 카드 결과 · 근거 상세) → 서버 컴포넌트에서 `apiGet`
  - 사용자 조작에 따라 **다시 부르는** 데이터(지도 · 시계열 · 근거 수요표 필터) → 클라이언트 컴포넌트에서 `useQuery`
- **규칙**: 쿼리는 `queryOptions(...)` 로 슬라이스의 `api/` 세그먼트에 정의한다(키 · 함수 · 옵션을 한 곳에). Provider 는 `src/app/query-client`.

### 응답 검증 — Zod

- **이유**: 백엔드 응답이 계약(C2)과 다르면 화면 깊숙이에서 `undefined` 로 터진다. 경계(`apiGet` · `browserGet`)에서 스키마로 검증하면 어긋남이 바로 드러나고, 타입은 `z.infer` 로 얻는다.
- **대안**: 타입 단언만(`as T`, 검증 없음), Valibot (번들은 작지만 팀 익숙도 · 생태계가 Zod 쪽).
- **규칙**: 스키마는 슬라이스 `model/schema.ts`. 필요한 필드만 검증한다(나머지는 무시). C2 OpenAPI 가 나오면 스키마 생성(openapi-zod 계열) 도입을 검토한다.

### API 호출 경로

- 서버 컴포넌트: `apiGet(path, schema)` → `API_BASE_URL`(서버 전용 환경 변수)로 Spring 직접 호출
- 클라이언트: `browserGet(path, schema)` → `/api{path}` → `next.config.ts` rewrites → Spring
- **이유**: 브라우저에 백엔드 주소를 노출하지 않고, CORS 설정이 필요 없다.

### 지도 — MapLibre GL JS

- **이유**: 오픈소스 · 무료(토큰 불필요), 벡터 타일, 이동선(라인) · 단계구분도 표현에 충분.
- **대안**: Leaflet (래스터 중심, 대량 라인에 느림), Mapbox GL (유료 토큰), deck.gl (대규모 시각화엔 강하지만 지금 규모엔 과함 — 이동선이 무거워지면 MapLibre 위에 얹는 방식으로 재검토).
- **규칙**: 브라우저 전용이라 `"use client"` + 동적 import(`ssr: false`). jsdom 에서 그려지지 않으므로 컴포넌트 테스트에서는 가짜로 바꾼다.

### 차트 — 화면 확정 뒤 결정

- 후보: Recharts (React 친화, 간단한 시계열에 충분), ECharts (기능 많음, 번들 큼), visx (자유도 높음, 손이 많이 감).
- 와이어프레임 확정 뒤 시계열 · 막대 요구를 보고 하나를 고른다.

## 3. 테스트

원칙: **페이지 테스트는 최소, 단위 · 컴포넌트는 필요할 때.** 스냅샷 테스트는 쓰지 않는다. 작성 · 실행 절차는 `test` 스킬(`.agents/skills/test`).

| 층 | 무엇을 | 도구 | 언제 | 명령 |
| --- | --- | --- | --- | --- |
| 단위 | Zod 스키마, 변환 · 포맷 함수, 훅의 계산 | Vitest | 계산 · 변환이 생기면 | `pnpm frontend:test` |
| 컴포넌트 | 상태 · 분기가 있는 클라이언트 컴포넌트의 화면 변화 | Vitest + Testing Library(jsdom) | 상태 있는 컴포넌트만 | `pnpm frontend:test` |
| API 가짜 응답 | 컴포넌트 테스트에서 Spring 대신 정해진 응답 | MSW (`mswServer.use`) | 서버 데이터를 쓰는 컴포넌트 | — |
| 페이지 | 빌드된 앱을 브라우저로 열어 핵심 흐름 확인 | Playwright (`page.route` 로 API 응답) | 페이지 완성 시 1~3개 | `pnpm frontend:e2e` |

- `pnpm check` 에는 단위 · 컴포넌트(빠름), `pnpm check:all` 에는 페이지 테스트(빌드 포함)가 들어간다.
- 비동기 서버 컴포넌트는 Vitest 로 테스트하지 않고 페이지 테스트로 확인한다.
- 테스트 도구 위치: `src/shared/lib/test`(`renderWithQuery`, `mswServer`), 설정 `vitest.config.mts` · `vitest.setup.ts` · `playwright.config.ts`.

## 4. 예시 코드 (구조 확인용)

랜딩 화면과 로고가 레이어를 나눠 쓰는 모습이다. API 를 부르는 예시(서버 상태 배지: `model/schema.ts` → `api/*Query.ts` → `useQuery`)는 확정 랜딩으로 바꾸며 뺐다(S15P31C108-142). 첫 API 화면이 들어오면 그 슬라이스가 예시를 이어받는다.

```
shared/ui/logo/               로고(심벌 · 로크업). 여러 화면이 쓰는 브랜드 요소라 shared
├── geometry.ts · contour.ts  꼭짓점과 윤곽 · 펼침 · 스프링 계산 (+ contour.test.ts 단위 테스트)
└── AtlasMark.tsx · Lockup.tsx  호버로 펼쳐지는 클라이언트 컴포넌트 (+ Lockup.test.tsx 컴포넌트 테스트)
pages/landing/
├── lib/globe.ts · statue.ts  지구(three) · 석상 · 바닥 그림자 그리기. globe 는 필요할 때 따로 불러온다
└── ui/LandingPage.tsx        서버 컴포넌트. 캔버스만 클라이언트(AtlasScene.tsx)
e2e/landing.spec.ts           페이지 테스트
```

한 페이지에서만 쓰는 코드는 `pages/landing` 안에 둔다(steiger `insignificant-slice`). 두 곳 이상에서 쓰이면 `entities` 로 옮긴다. 로고 명세는 `docs/design/logo.md`.

## 5. 환경

- Node `^22.22.2 || >=24.15.0` (`.nvmrc` = 24). Vitest 5 · jsdom 30 · MSW 3 의 요구 버전
- Playwright 브라우저: 처음 한 번 `pnpm --filter frontend exec playwright install chromium`
