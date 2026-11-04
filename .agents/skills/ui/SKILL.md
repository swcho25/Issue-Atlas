---
name: ui
description: Figma 화면 · 컴포넌트를 프론트에 만든다 — Figma 값 읽기, 토큰으로 구현, /dev/ui 견본, 자동 대조, 브라우저 확인. 사람이 "/ui <화면 · 컴포넌트>" 로 부를 때 쓴다.
---

# ui

Figma 와 「눈대중」이 아니라 「숫자」로 맞춘다. 순서를 건너뛰지 않는다.

## 1. 읽기 (고치기 전)

1. `frontend/src/app/styles/globals.css` — **Tailwind 설정 파일**. 맨 위 목차와 토큰 이름(색 · 글자 · 모서리 · 그림자 · 유리 · 겹침 순서)을 읽는다. `tailwind.config.js` 는 없다.
2. `docs/design/DESIGN.md` — 쓰임 규칙(앰버는 누르는 것만, 유리는 지도 위에서만 …).
3. `frontend/src/shared/ui/` — 이미 있는 공통 컴포넌트. 있으면 새로 만들지 않고 쓴다.
4. **Figma 값**: Figma MCP(`get_design_context`)가 되면 그것으로, 안 되면 브라우저에서 Figma 파일을 열고 콘솔의 Plugin API(`figma.getNodeByIdAsync`)로 노드의 크기 · 간격 · 자동 배치 · 글자 스타일 · 색 변수 · 효과를 읽는다.
   - 변수에 묶인 색은 변수 이름으로 → 같은 이름의 토큰 클래스.
   - 아이콘은 `exportAsync({ format: "SVG_STRING" })` 로 받아 `currentColor` 로.

## 2. 만들기

- 클래스는 globals.css 에 있는 이름만. 없는 값이 필요하면 **토큰을 먼저 추가할지 사람에게 묻는다**(한 컴포넌트에서만 쓰는 크기는 `h-[68px]` 처럼 숫자 가능).
- 토큰 밖 색 · 글자 크기 · 그림자 · 숫자 z 는 ESLint 가 막는다. 오류 문구대로 고친다.
- Figma 와 웹이 다르게 그리는 곳:
  - 자간 % → em
  - 배경 흐림은 Figma 값의 절반
  - 안쪽 · 가운데 테두리
  - 자동 배치에서 빈 칸(spacer)의 앞뒤에도 간격이 붙는다
- FSD 위치 · 서버/클라이언트 경계는 `frontend/AGENTS.md`.

## 3. 견본에 놓기

- `frontend/src/pages/ui-catalog/` 에 칸을 추가해 `/dev/ui` 에 Figma 변형을 모두 늘어놓는다(고른 · 누른 · 비활성 …).
- 화면에 넣는 줄은 Edit 로 넣고, 넣은 뒤 grep 으로 들어갔는지 확인한다.

## 4. 자동 대조 (완료의 조건)

개발 서버(`pnpm frontend:dev`)의 `/dev/ui` 에서 브라우저 스크립트로 계산값을 Figma 값과 비교한다.

| 대상 | 읽는 값 |
| --- | --- |
| 위치 · 크기 | `getBoundingClientRect()` 를 부모 기준 좌표로 → Figma `x · y · width · height` |
| 글자 | `getComputedStyle` 의 `fontSize · lineHeight · letterSpacing · fontWeight` → IA5 스타일 |
| 색 · 그림자 | `backgroundColor · color · boxShadow` → Figma 변수 · 효과 값 |

- 오차 0.6px 이내 · 값 일치가 아니면 고치고 다시 잰다.
- Tailwind 는 소스에 적힌 클래스만 만든다. 「클래스가 안 먹는다」를 확인할 때는 그 클래스를 소스에 잠깐 넣고 재고, 확인 후 지운다.
- 대조 결과(몇 개 중 몇 개 일치, 고친 것)를 실행 계획 파일 「진행」에 한 줄로 남긴다.

## 5. 마무리

- 브라우저로 직접 보고(Light · Dark), lint · typecheck · test 를 돌린다(`check` 스킬).
- 단위 하나가 끝나면 멈추고 사람에게 보여 준다. 커밋 · 푸시는 사람이 정한다.

## 하지 않는 것

- Figma 값을 눈으로 재서 넣지 않는다.
- `tailwind.config.js` 를 만들거나 Tailwind 기본 값(`text-sm` · `shadow-lg` · `bg-blue-500`)을 되살리지 않는다.
- 유리를 흰 화면 위에 쓰지 않는다.
