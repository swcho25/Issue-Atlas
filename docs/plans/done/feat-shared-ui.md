# feat/shared-ui — 공통 버튼(Figma v5/Button)

- Jira: S15P31C108-239 · PRD: — · 묶음/단위: 화면 공통 세팅 (U6)

## 완료 조건
- [x] `shared/ui/button` 이 v5 화면에서 쓰는 Figma `v5/Button` 6 변형(Primary · Secondary · Ghost × M · S)과 같다(높이 · 여백 · 글자 · 바탕 · 글자색 · 선 · 그림자 자동 대조)
- [x] 아이콘 · 비활성 · 링크용 `buttonClass()` 가 있다
- [x] 견본 `/dev/ui` 에 모든 변형
- [x] 버튼 그림자는 토큰(`shadow-button` · `shadow-button-soft`)으로, v5 화면 버튼 37개가 컴포넌트 그림자를 그대로 쓴다

## 진행
- 2026-11-04: 시작. `ui` 스킬 순서로. 브라우저 Figma 가 로그아웃돼 있어 사용자가 로그인한 뒤 Plugin API 로 `v5/Button`(2375:396) 10 변형을 읽음. IA5 글자 스타일이 Figma 에서도 Pretendard 로 바뀌어 있음
- 2026-11-04: 그림자 토큰 `shadow-button`(흰 테두리 빛 + 안쪽 빛 + 0 2 6 14%) · `shadow-button-soft`(0 1 3 6%)를 먼저 추가(센서가 `shadow-[…]` 를 막아서). 첫 대조에서 Secondary 좌우 여백이 1px 넓음(Figma 테두리는 안쪽이라 여백을 안 차지하는데 CSS border 는 차지) → `inset-ring` 으로 바꿔 10/10 일치. 아이콘 16 · 14, 비활성 40%
- 2026-11-04: v5 화면에서 실제 쓰임 확인(Design notes v5 인스턴스 집계). `v5/Button` 37번: Primary 13 · Secondary 16 · Ghost 8, **AI · Danger 0번**. 24번은 아이콘 켬(check · copy · download · external · home · map · play · refresh). 크기 덮어쓰기 없음, Primary 아이콘 색만 먹색으로 덮어씀(웹은 currentColor 라 같음). 다른 버튼: Glass/Icon button 40 · Button/뒤로 17 · Button/키 컬러 12 · Button/유리 · 로그인 5 · Button/랜딩 시작 2
- 2026-11-04: 사용자 결정으로 AI · Danger 변형 뺌(v5 화면 0번). 6 변형 다시 대조 6/6 일치
- 2026-11-04: 그림자 확인. v5 화면 버튼 37개 모두 컴포넌트 그림자 그대로(덮어쓰기 0). 범위를 버튼(U6)으로 좁혀 마무리, 배지 · 탭 바 · README 는 다음 MR
- 2026-11-04: 마무리. Jira S15P31C108-239. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- U7 상태 배지 `v5/Status` · 출처 배지 `v5/Prov badge`, U8 탭 바, U9 `shared/ui/README.md` — 다음 MR
- 버튼 아이콘 8가지(v3/Icon: check · copy · download · external · home · map · play · refresh)를 `shared/ui` 아이콘으로
- AI · Danger 버튼은 쓰는 화면이 생기면 더한다(값은 작업기록 20번 표)
- 호버 모습은 Figma 에 없어 Primary 만 `primary-hover`, 나머지는 바탕 한 단계로 가장 작게 넣음 → 디자이너 확인
- 버튼 폭은 글자 폭에 따라 Figma 와 1 – 2px 다를 수 있다(Figma 「버튼」 53, 웹 50.4). 글꼴 그리기 차이
- `Button/키 컬러`(L 56 · M 36, 유리 바 안) · `Button/뒤로`(36 동그라미) · `Glass/Icon button` 은 쓰는 화면(결과 · 05 탭)을 만들 때
