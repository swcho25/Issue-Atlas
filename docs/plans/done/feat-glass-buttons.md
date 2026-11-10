# feat/glass-buttons — 뒤로 버튼 · 유리 아이콘 버튼(Figma Button/뒤로 · Glass/Icon button)

- Jira: S15P31C108-248 · PRD: — · 묶음/단위: 화면 공통 세팅 (U10 전 준비)

## 완료 조건
- [x] `BackButton` 이 Figma `Button/뒤로`(2411:560) 와 같다 — 36 · surface-2 · 안쪽 선 border-1 · chevron 20 · 선 2(자동 대조). 모양만 담고 동작은 onClick
- [x] `GlassIconButton` 이 Figma `Glass/Icon button`(2410:657) 두 형태와 같다 — 아이콘 40 · 글자(왼 14 · 오 16 · 간격 6 · 굵게 14)(자동 대조)
- [x] 견본 `/dev/ui` 「뒤로 · 유리 아이콘 버튼」 칸, `shared/ui/README.md` 목록

## 진행
- 2026-11-04: 시작. v5 화면 쓰임: 뒤로 17번(모두 화면 머리, chevronRight 180° 회전 · 선 2, 「질문 바꾸기」 글자는 모두 숨김) · 유리 아이콘 39번(copy 11 · bookmark 14 · refresh 14) + 글자 형태 1번(관리자 「2회차 실행」 play). 유리 채움(흰 10% 위 흰 45%)은 기존 `glass glass-strong`(50.5%)과 같아 새 유틸리티 없이 씀. 뒤로 버튼 선 굵기 2 때문에 `Icon` 에 `weight` 를 더함
- 2026-11-04: 자동 대조 — 크기 · 아이콘 위치 · 선 굵기 · 글자 · 채움 · 그림자 일치. 글자 형태 첫 회 아이콘이 1px 오른쪽(glass 의 1px 선이 자리를 차지, Figma 테두리는 안쪽) → 여백을 13 · 15 로 줄여 14 · 16 일치. `pnpm check` 통과
- 2026-11-04: 뒤로 버튼을 링크(href)에서 모양만 담은 `button`(onClick)으로 바꿈(사용자). 이전 화면 이동과 옆 패널 닫기에 함께 쓰므로 동작은 쓰는 쪽이 정한다. 링크로 쓸 곳을 위해 `backButtonClass()` · `BackIcon` 도 내보냄
- 2026-11-04: 뒤로 버튼의 `label` prop 도 뺌(사용자) — 이름은 「뒤로」 고정, 바꿀 일이 있으면 일반 `aria-label` 로 덮어씀. 마무리. Jira S15P31C108-248. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- Figma 와 남은 차이(디자이너 확인): 유리 테두리 빛이 Figma 는 그라데이션 95 · 20 · 15 · 75% 이고 웹 `glass` 는 안쪽 빛 95 · 30% + 옅은 먹색 선 14%(기존 유리 규칙). 글자 형태 폭은 글꼴(Figma Gothic A1 · 웹 Pretendard) 차이로 124 → 115
- 호버 모습은 Figma 에 없음 — 뒤로는 surface-3, 유리는 채움 62% 로 가장 작게
- `v5/Map controls`(확대 · 위치 · 층) · `Button/키 컬러` 는 지도 · 결과 화면을 만들 때
