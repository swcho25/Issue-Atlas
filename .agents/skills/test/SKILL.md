---
name: test
description: 바뀐 frontend 코드에 맞는 테스트(단위 · 컴포넌트 · 페이지)를 골라 작성하고 실행한다. 기능을 구현했거나 고친 뒤, finish 전에 쓴다.
---

# test

테스트는 **필요한 만큼만** 쓴다. 층을 고르는 기준이 이 스킬의 핵심이다. 도구 설정은 `docs/frontend-architecture.md` 「테스트」.

## 1. 대상 고르기

`git diff origin/develop...HEAD --name-only` + 커밋 안 된 변경에서 `frontend/src` 파일만 본다. 파일마다 아래 표로 층을 정한다.

| 바뀐 것 | 층 | 위치 · 도구 |
| --- | --- | --- |
| Zod 스키마, 변환(mapper), 포맷 함수, 커스텀 훅의 계산 | **단위** | 같은 폴더 `*.test.ts` · Vitest |
| 상태 · 분기가 있는 클라이언트 컴포넌트 (입력 · 선택 · 로딩/오류 표시) | **컴포넌트** | 같은 폴더 `*.test.tsx` · Testing Library · `renderWithQuery` |
| 서버 응답이 필요한 컴포넌트 | 컴포넌트 + **MSW** | `mswServer.use(http.get("*/api/...", ...))` |
| 페이지가 **완성됐을 때** (사람이 "페이지 완성"이라고 했거나 계획 파일 완료 조건에 있을 때) | **페이지** | `frontend/e2e/<페이지>.spec.ts` · Playwright, 페이지당 1~3개 |

쓰지 않는 것
- 상태 없는 표시용 컴포넌트, 스타일만 바뀐 것, 단순 re-export
- 비동기 서버 컴포넌트를 Vitest 로 (→ 페이지 테스트에서 확인)
- 스냅샷 테스트
- 지도(MapLibre) 실제 렌더링을 jsdom 에서 (→ 컴포넌트 테스트에선 `vi.mock` 으로 대체, 페이지 테스트에서 "보인다" 정도만)

## 2. 작성 규칙

- 테스트 이름은 한국어로 **사용자가 보는 결과**를 쓴다. 예: `서버 오류면 응답 없음으로 보인다`
- 요소는 역할 · 텍스트로 찾는다 (`getByRole`, `findByText`). `data-testid` 는 다른 방법이 없을 때만
- 클릭 · 입력은 `@testing-library/user-event`
- API 응답은 계약(C2)과 같은 모양으로. 계약과 다른 응답이 오류로 처리되는지도 한 개 둔다
- 테스트끼리 상태를 공유하지 않는다 (`renderWithQuery` 가 매번 새 QueryClient)
- 페이지 테스트는 백엔드 없이 돈다: `page.route("**/api/...")` 로 응답을 정한다

## 3. 실행

1. `pnpm frontend:test` — 실패하면 고치고 다시. 같은 실패를 3번 못 고치면 멈추고 보고
2. 페이지 테스트를 추가 · 수정했으면 `pnpm frontend:e2e`
3. 테스트를 통과시키려고 기대값을 바꾸거나 `skip` 하지 않는다. 기대값이 틀렸다고 판단되면 이유를 적어 사람에게 묻는다

## 4. 기록

실행 계획(`docs/plans/active/<branch>.md`) 「진행」에 한 줄: 추가한 테스트 수(층별)와 결과.
