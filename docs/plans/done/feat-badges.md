# feat/badges — 상태 배지 · 출처 배지(Figma v5/Status · v5/Prov badge)

- Jira: S15P31C108-241 · PRD: — · 묶음/단위: 화면 공통 세팅 (U7)

## 완료 조건
- [x] `shared/ui/badge` 의 `StatusBadge` 가 Figma `v5/Status` 6 색조와 같다(높이 · 여백 · 점 · 글자 · 바탕 · 점색 · 글자색 자동 대조)
- [x] `ProvBadge` 가 Figma `v5/Prov badge` 4 종류(규칙 · 카드 · AI · 검수)와 같다(아이콘 포함)
- [x] 견본 `/dev/ui` 에 모든 변형

## 진행
- 2026-11-04: 시작. `ui` 스킬 순서로. Figma `v5/Status`(2375:430) · `v5/Prov badge`(2375:449)를 Plugin API 로 읽음. v5 화면 쓰임: 상태 121번(초록 44 · 회색 32 · 주황 30 · 파랑 7 · 빨강 6 · 앰버 2) · 출처 30번(규칙 17 · 카드 7 · AI 4 · 검수 2), 덮어쓰기 0 → 모든 변형을 만든다
- 2026-11-04: 상태 배지 높이 22 · 왼쪽 6 오른쪽 7 · 점 6 · 간격 5 · Label 12, 출처 배지 높이 18 · 왼쪽 4 오른쪽 5 · 아이콘 10 · 간격 3. Figma `Tone=Violet` 은 실제 앰버(primary) 색이라 `tone="primary"`. 출처 배지 바탕은 Figma 값 그대로(AI = 먹색 10%, 검수 = status-amber 10%). 견본에서 10개 자동 대조 첫 회 10/10 일치. `pnpm check` 통과
- 2026-11-04: 마무리. Jira S15P31C108-241. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- Figma 확인 요청: 출처 배지 「AI」 바탕이 먹색 10%, 「검수」 바탕이 status-amber 10% 로 글자색(prov-ai · prov-human)과 다르다. `Tone=Violet` 이름도 실제 색(앰버)과 다르다
- U8 탭 바, U9 `shared/ui/README.md`
