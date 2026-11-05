# frontend — Next.js · FSD

Next.js 16(App Router) + TypeScript(strict) + Tailwind CSS 4. 폴더 구조는 [Feature-Sliced Design](https://feature-sliced.design)을 따른다.

EC2 배포·CI/CD와 Workers에서의 전환 절차는 [프론트 배포 안내](../deploy/frontend/README.md)를 참고한다.

## 폴더

```
frontend/
├── app/            Next 라우팅 전용. page.tsx 는 src/pages 의 화면을 다시 내보내기만 한다
├── pages/          비워 둠 (README 만). Next 가 src/pages 를 Pages Router 로 읽지 않게 막는다
├── public/
└── src/
    ├── app/        FSD app 레이어 — 전역 스타일, Provider
    ├── pages/      화면 단위 (랜딩, 카드·기간, 근거 수요표, 논증 카드, 검수 …)
    ├── widgets/    화면을 이루는 큰 블록 (지도, 카드 목록, 질문 바, 근거 패널 …)
    ├── features/   사용자 행동 (지역 선택, 기간 선택, 질문 실행, 각주 복사, 수정 제안 …)
    ├── entities/   도메인 객체 (place, card, question, run, argument, evidence, observation …)
    └── shared/     공용 (api, config, ui, lib)
```

## 규칙

- **위에서 아래로만 import 한다.** app → pages → widgets → features → entities → shared. 같은 레이어의 다른 슬라이스는 import 하지 않는다.
- **슬라이스 밖에서는 `index.ts`(public API)로만 가져온다.** `@/entities/card/model/types` 처럼 안쪽 파일을 직접 import 하지 않는다.
- **슬라이스는 쓰일 때 만든다.** 아무 데서도 쓰지 않는 슬라이스는 FSD 검사(steiger)가 막는다.
- import 경로는 `@/` = `src/`.
- `pnpm lint` 가 ESLint 와 FSD 검사(steiger)를 함께 돌린다.

## 서버·클라이언트 경계

- 결과를 읽는 화면(논증 카드 결과, 근거 상세, 내 질문)은 서버 컴포넌트로 그린다.
- 지도·시간 슬라이더·선택 UI 는 클라이언트 컴포넌트(`"use client"`). MapLibre 는 브라우저 전용이라 서버에서 그리지 않는다.
- Spring API 는 `@/shared/api` 로 부른다. 주소(`API_BASE_URL`)는 서버 전용 환경 변수라 브라우저에 노출되지 않는다.

## 명령 (루트에서)

| 명령 | 하는 일 |
| --- | --- |
| `pnpm frontend:dev` | 개발 서버 (http://localhost:3000) |
| `pnpm --filter frontend mock:api` | 목 API 서버 (http://localhost:4010). 개발 서버를 `API_BASE_URL=http://localhost:4010` 으로 띄우면 `/results/{계약 예시 run_id}` 가 `contracts/c2/examples` 로 그려지고, 나머지 요청은 dev 백엔드로 간다 |
| `pnpm frontend:lint` | ESLint + FSD 검사 |
| `pnpm frontend:typecheck` | 라우트 타입 생성 + tsc |
| `pnpm frontend:test` | 단위 · 컴포넌트 테스트 (Vitest) |
| `pnpm frontend:e2e` | 빌드 + 페이지 테스트 (Playwright). 처음 한 번 `pnpm --filter frontend exec playwright install chromium` |
| `pnpm frontend:build` | 프로덕션 빌드 |

## 스타일 (Tailwind CSS 4)

- 설정 파일 없이 `src/app/styles/globals.css` 에서 관리한다(`@import "tailwindcss"`, `@theme`).
- 디자인 토큰은 CSS 변수(`--background` 등)로 두고 `@theme inline` 으로 유틸리티에 연결한다 → `bg-background`, `text-foreground`.
- 다크 모드: 기본은 OS 설정, `<html data-theme="light|dark">` 로 강제. `dark:` 변형도 같은 규칙을 따른다.
