# feat/shared-ui-icons — 공통 아이콘 · shared/ui 안내(README)

- Jira: S15P31C108-246 · PRD: — · 묶음/단위: 화면 공통 세팅 (U9)

## 완료 조건
- [x] `shared/ui/icon` 의 `Icon` 이 Figma `v3/Icon`(2007:266) 중 v5 화면에서 쓰는 30개를 그린다(경로는 Figma 내보내기 그대로, 크기별 선 굵기가 Figma 와 같다)
- [x] 흩어진 아이콘 SVG(띠 메뉴 · 출처 배지 · 견본)를 `Icon` 으로 바꾼다
- [x] `shared/ui/README.md` — 공통 컴포넌트 목록 · 쓰는 법 · 아직 없는 것 · 더하는 순서
- [x] 하네스가 README 를 보게 한다(`frontend/AGENTS.md` 스타일 · `ui` 스킬 · globals.css 목차)
- [x] 견본 `/dev/ui` 에 아이콘 30개 × 16 · 20 · 24

## 진행
- 2026-11-04: 시작. U6 에서 남긴 「버튼 아이콘 8개」를 넘어 v5 화면의 v3/Icon 쓰임을 셌다(41개 중 30개, 예: sparkle 67 · check 50 · bookmark 46 · close 34). 30개를 Plugin API `exportAsync(SVG_STRING)` 로 받아 좌표를 소수 둘째 자리로 줄임(clipPath 2개는 판 크기와 같아 뺌). 선 아이콘 26 · 칠 아이콘 4
- 2026-11-04: Figma 인스턴스의 선 굵기는 크기에 비례(10 – 24 에서 1.45833 × 크기/20). 판 20 에 선 굵기를 두어 같은 비율이 되게 함. 견본에서 버튼 m 16 · s 14, 탭 24 / 1.75, 띠 18, 출처 10, 견본 16 / 1.167 · 20 / 1.458 · 24 / 1.75 — Figma 와 같음
- 2026-11-04: 띠 메뉴 `icons.tsx` 를 지우고 `Icon` 으로(메뉴 타입 `MenuIcon` → `IconName`). 출처 배지 반짝 · 탭 바 견본 · 버튼 견본도 `Icon`
- 2026-11-04: 마무리. Jira S15P31C108-246. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- `Glass/Icon button` · `Button/뒤로` · `Button/키 컬러` 는 쓰는 화면(05 화면 · 지도)을 만들 때
- 다크 모드 토글의 해 · 달 아이콘은 v3/Icon 에 없어 그대로 둠
