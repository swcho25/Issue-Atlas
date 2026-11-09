# feat/result-c2-v1-label-applicability — 결과 화면 C2 v1 판단 배지 · 못 채운 적용 조건

- Jira: S15P31C108-306 · PRD: — · 묶음/단위: C2 v1 받는 쪽(S15P31C108-283 · !191 후속)

## 완료 조건
- [x] 계약 예시 5개(새 `argument-c1-unsupported-years.json` 포함)가 새 zod 를 통과하고, 계약 스키마 규칙 3개(blocked · unsupported → label null, passed false → unsupported, 카드 없음 → applicability [])를 검사한다
- [x] 04 결과 카드 · 05 논증 탭 · 04 유리 바의 판단 배지가 `claim.label`(blocked 「자료 부족」 · unsupported 「근거 부족」, C2 v1 전 실행은 이전 배지)
- [x] unsupported(연 값 부족 예시)에 근거 4종 · 비교 조건 대신 ✕ 「완전한 연 값 3개 이상 — 2개(2024–2025)」
- [x] 카드 있는 unsupported 를 「카드 밖」이라 부르지 않는다(04 실행 상태 배지 · 05 실행 상태 문장)

## 진행
- 2026-11-08: 시작. 계약 c2 README 「판단 배지 · 적용 조건」(내 리뷰 1 · 2번 반영: ready · partial 의 null 은 이전 배지, 빠진 해는 「2개(2023 · 2025)」).
  Figma 08 「State / 카드 조건 밖 (unsupported)」: 실행 상태 「unsupported · 카드 조건 밖」(회색), 근거 4종 · 비교 조건 대신 「① 못 채운 적용 조건」(줄 status-red-soft · 모서리 8 · 안쪽 9 · 10 · ✕ 빨강 · 조건 Medium 13 · 사유 12) + 「근거 4종과 비교 조건은 보지 않아요. 조건을 채우는 지역이나 다른 이슈로 다시 물어보세요.」, 판단 배지 「근거 부족」 회색. blocked 판단 배지 「자료 부족」 회색
- 2026-11-08: zod `claim.label` · `applicability` + 규칙 3개. `model/labels` 의 `judgmentBadge` · `unmetConditions`, `ResultCard`(배지 · 「카드 조건 밖」 · `UnmetConditions`), `ArgumentTab` · `MapOverlays` 유리 바 배지, `EvidencePanel` unsupported 문장(카드 있으면 못 채운 조건 이름).
  머리 보조 글자는 Figma 「근거를 찾기 전에 멈춤」 대신 「판단 전에 멈춤」(연 값 · 측정소 부족은 근거를 찾은 뒤 멈춘다).
  브라우저(로그인 뒤, 목 서버): ready 「청년 순유출 확대」(04 카드 · 05 논증) · 연 값 부족 「근거 부족」 + ✕ 줄 · blocked 「자료 부족」 · 카드 없음 「근거 부족」 · 05 문장 「카드 적용 조건(완전한 연 값 3개 이상)을 못 채워 판단하지 않았어요.」.
  `pnpm check` 통과(스키마 테스트 5개 · 배지 테스트 4개 추가)
- 2026-11-08: 마무리. Jira S15P31C108-306. `pnpm check:all` 9개 통과(첫 실행은 컴퓨터가 멈춰 frontend test 4개가 시간 초과 · 워커 시작 실패 — 다시 돌려 통과)

## 다음 할 일 / 범위 밖
- 내 질문 화면(호성)의 판단 배지는 목록 응답(`GET /v1/me/questions`)에 label 이 없어 그대로 `claim.value` — 계약에 칸이 생기면 맞추기
- Figma 의 경고 줄(「⚠ 이 카드는 해안에 접한 시군구에만 쓸 수 있어요」)은 응답에 문장이 없어 넣지 않음
- !197(최동준, series.baseline)이 같은 `argument.ts` 를 고침 — 뒤에 머지하는 쪽이 칸을 합치기
