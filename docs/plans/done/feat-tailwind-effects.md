# feat/tailwind-effects — Tailwind 효과 토큰 (primary · 그림자 · 유리 · 겹침 순서)

- Jira: S15P31C108-226 · PRD: — · 묶음/단위: 화면 공통 세팅

## 완료 조건
- [x] ① `bg-primary` 짧은 이름, 그림자 7개(IA/Shadow 5 + 결과 카드 · 범례)가 Figma 값과 같다
- [x] ② 유리 효과 `glass`(+ 채움 `glass-strong` · `glass-thin`)가 있다(Figma Glass/Control 웹 흉내. Glass/Panel 은 v5 에서 안 써서 뺌)
- [x] ③ 겹침 순서 이름(`z-map` … `z-modal`), Tailwind 기본 색 · 그림자 제거
- [x] 견본 `/dev/ui` 에 그림자 · 유리 · 겹침 순서 칸, `frontend/AGENTS.md` 갱신

## 진행
- 2026-11-03: 시작. Figma v5 「Design notes」 노드 11,284개에서 색 · 효과 사용 횟수를 셈. 색은 기존 토큰과 겹치고, 효과는 Glass/Control 105 · IA/Shadow xs 12 · md 7 순. `feat/app-rail`(MR !123) 위에서 땀(견본 · AGENTS.md 가 겹쳐서)
- 2026-11-03: ① primary · 그림자. `--color-primary` 를 `primary-base` 의 짧은 이름으로. 그림자는 Figma IA/Shadow 5개 + 결과 카드(0 10 36 14%) · 범례(0 6 20 10%), Tailwind 기본 그림자는 지움. 견본 「그림자」 칸에서 7개 계산값을 Figma 효과 값과 자동 대조해 일치, `shadow-lg` 는 none
- 2026-11-03: ② 유리. Figma 를 다시 읽으니 Glass/Panel 스타일은 어디에도 안 쓰이고(지도 레이어 판도 Glass/Control), 유리끼리는 흰 채움만 다름(10% + 45 · 32 · 8%). 그래서 `glass` 하나 + 채움 `glass-strong` · `glass-thin`. 테두리 광택은 DESIGN.md 흉내 방식(안쪽 흰 빛 + 먹색 14% 선). 견본 「유리」 칸(지도 비슷한 바탕 위 Figma 크기 3개)에서 채움 50.5 · 17.2 · 38.8%, 배경 흐림, 그림자 0 4 14 12% 확인
- 2026-11-03: ③ 겹침 순서 · 기본 색. `@utility z-map … z-modal`(0 · 10 · 20 · 30 · 40 · 50). `--color-*: initial` 로 기본 색을 지우고 `white` · `black` 만 다시 둠. 기본 색 · 숫자 z 를 쓰는 곳 0 곳 확인 후 적용. 시험 줄로 확인: `bg-blue-500` 투명 · `shadow-lg` none · `bg-white/20` · `bg-text-1/7` 은 정상. 견본 「겹침 순서」 칸은 일부러 위층부터 그려도 이름대로 겹침. `frontend/AGENTS.md` 스타일 절에 primary · 투명도 · 그림자 · 유리 · 겹침 순서 규칙
- 2026-11-03: 마무리. `pnpm check:all` 후 MR. MR !123 이 아직 머지 전이라 대상 브랜치를 `feat/app-rail` 로(머지되면 GitLab 이 develop 으로 바꿈)

## 다음 할 일 / 범위 밖
- 앰버 버튼 테두리 광택(안쪽 흰 빛)은 버튼 컴포넌트(U6)에서
- `z-10` 같은 숫자 겹침 순서는 Tailwind 가 설정과 상관없이 받아 막을 수 없다 → AGENTS.md 규칙으로만. 같은 실수가 두 번 나오면 ESLint 규칙(클래스 문자열 검사)으로
- 다크 모드 유리 사양(디자이너와)
- 지도 화면을 만들면 `backdrop-filter` 때문에 지도 끌기 프레임이 떨어지는지 잴 것
