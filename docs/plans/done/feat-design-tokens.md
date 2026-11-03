# feat/design-tokens — Figma v5 디자인 토큰을 프론트에 적용

- Jira: S15P31C108-217 · PRD: — · 묶음/단위: 화면 공통 세팅

## 완료 조건
- [x] U1 Figma 변수 IA v5 색 43개(brand/* · key/amber 제외)가 Light · Dark 값으로 `globals.css` 에 있고 `bg-surface-1` 같은 클래스로 쓰인다
- [x] U3 개발 모드에서만 열리는 `/dev/ui` 견본 페이지에서 색 · 글자 스타일을 Figma 와 나란히 비교했다
- [x] U2a 한글 Pretendard · 영문 IA Latin(Gothic A1, 굵기별 size-adjust) 글꼴이 DESIGN.md 「한영 섞어 쓰기」 표대로 걸린다
- [x] U2b 글자 스타일 15개 · 모서리 · 간격이 클래스로 있다
- [x] `frontend/AGENTS.md` 스타일 절이 DESIGN.md 와 새 토큰 이름을 가리킨다

## 진행
- 2026-11-03: 시작. 단위마다 사람이 확인 · 커밋한다
- 2026-11-03: U1 색 토큰. Figma Plugin API 로 IA v5 변수 48개를 읽어 넣음. 다크 값은 `light-dark()` 한 줄로(색마다 두 번 쓰지 않으려고), `color-scheme` 이 기존 dark 변형과 같은 규칙을 따른다. `--background` · `--foreground` 는 `bg-app` · `text-1` 로 바꿈
- 2026-11-03: U3 견본 페이지 `/dev/ui`(색). 화면에 나온 43개 값을 Figma 변수와 자동 대조해 Light · Dark 모두 일치. Tailwind(LightningCSS)가 `light-dark()` 를 :root 기준 변수로 바꿔서 요소 하나만 다크로 바꿀 수 없음을 확인 → 견본은 페이지 전체 전환 버튼으로, globals.css · AGENTS.md 에 적음
- 2026-11-03: U2a 글꼴. `pretendard@1.3.9`(가변 · 글자 범위별 조각) + `@fontsource/gothic-a1@5.3.0` 라틴 파일로 「IA Latin」 @font-face 8개(`ia-latin.css`), `--font-sans` = IA Latin → Pretendard Variable → Gothic A1. next/font 는 굵기별 size-adjust · unicode-range 를 못 넣어 직접 씀. 대문자 높이를 재 보니 IA Latin 이 400 – 900 모두 Pretendard 와 같은 71.9%. 견본 페이지에 굵기별 한영 문장 추가. 배포 빌드에서 글꼴 파일이 묶이고 `/dev/ui` 가 404 인 것 확인
- 2026-11-03: U2b 글자 · 모서리 · 간격. Figma IA5/ 15개를 `text-body-14` 처럼 크기 · 줄 높이 · 자간 · 굵기를 한 번에 거는 클래스로. Tailwind 기본 text-* · radius-* 는 지움(쓰면 안 먹어서 드러난다). 모서리 2xl 은 옛 변수(IA v3 · Size 24)가 아니라 v5 결과 카드 실측 22. 간격 `--spacing: 4px`. 견본에서 15개 · 모서리 5개를 Figma 값과 자동 대조해 일치
- 2026-11-03: 마무리. `pnpm check:all` 9개 통과. 견본 페이지는 다음 단위(사이드바 · 공통 컴포넌트) 비교에 쓰려고 남김

## 다음 할 일 / 범위 밖
- 랜딩 `--cta: #5a41fd`(보라)는 DESIGN.md 「보라 쓰지 않음」과 어긋남 → 호성 랜딩 작업에서 정리
- `brand/lime #C8F26B` 는 토스트 동작 글자에서 쓰므로 토스트(11/13) 때 토큰으로 넣는다
- 다음 브랜치: 앱 레이아웃 · 사이드바(U4 · U5), 공통 컴포넌트 · 하네스(U6 – U9). 시작 전 화면 주소를 호성과 맞춘다
- 랜딩 한글이 Pretendard 로 바뀜. 히어로 큰 「Issue Atlas」(맞추지 않은 Gothic A1 900)는 호성 랜딩 작업에서
- Figma 쪽: IA5/ 글자 스타일을 Pretendard 로(설치 필요), 모서리 변수 2xl 24 → 22
