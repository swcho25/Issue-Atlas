# fix/evidence-observed-date — 통계 · 분모 근거 시점을 마지막 관측일로

- Jira: S15P31C108-272 · PRD: (P5 논증 엔진) · 묶음/단위: P5 — 결과 05 화면 확인(11/5)에서 찾음

## 완료 조건
- [x] 통계 · 분모 근거의 `observed_at` 이 마지막 관측 기간의 끝 경계(다음 달 1일 0시)가 아니라 마지막 날(한국 0시) — `QuestionApiTest.latestObservedAtIsLastDayOfLastObservedMonth` · `c1RuleJudgesYearSumsOfMonthlyNetMigration` · `c1DenominatorIsLinkedFromRegisteredPopulation`
- [x] 이미 저장된 통계 · 분모 근거 행도 같은 값으로(V0048). 저장된 실행 결과는 고치지 않는다
- [x] 응답 모양 그대로. C2 README 「한정어」 · 변경 이력, DB 계약 v0.1.35
- [ ] 개발 서버에서 여수 C1 새 실행의 ④ 「최신 2025-12-31」 확인 — 병합 · 배포 뒤

## 진행
- 2026-11-05: 개발 DB 통계 근거 15행 · 분모 8행 모두 `observed_at` 이 달 첫날 0시(끝 경계). 지표 관측 최소 길이 28일, `when_end` 빈 행 없음 → 하루 빼기 안전. 새 실행은 `max(greatest(when_start, when_end - 1일))`

## 다음 할 일 / 범위 밖
- C1 카드 문구: 판단 ① 문장 틀(「…순이동이 청년 순유출 확대.」) · 비교 조건 「같은 경계」의 여수 코드 개편 설명이 광주 구에도 나옴 — 카드 판 올리기(데모 뒤)
- C1 규칙 빈틈 「순유출 전환」(양수 → 음수)이 불분명으로, 광주 동구 AI 보증의 「오르내림」 오기 — 최동준 전달
