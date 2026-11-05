# feat/ceiling-expected-gaps — 카드 예상 빈칸을 상한선에 문장으로 표시

- Jira: S15P31C108-265 · PRD: 인수 기준 ③ · 묶음/단위: P5 — 근거 상태 전수 점검(11/5) 후속, 장성우 제안(데모 전 단계)

## 완료 조건
- [x] 논증 응답 `ceiling.items` 끝에 카드 설계도 `expected_gaps` 가 「무엇: 문장 (상태)」로 붙는다 — `CeilingItemsTest`, `QuestionApiTest.c1RuleJudgesYearSumsOfMonthlyNetMigration`(C1 5 + 2 = 7줄)
- [x] 칸 추가 없음(C2 동결 안, 값만 바뀜). C2 README 질문 · 실행 구현 · 변경 이력
- [ ] 개발 서버 여수 C1 · A3 확인 — 병합 · 배포 뒤

## 진행
- 2026-11-05: 12건 점검에서 license_blocked · not_published 가 어느 칸에도 안 나왔다. 카드 설계도의 예상 빈칸(C1 민원 · 읍면동 순이동, A3 기상 자료 · 확정자료 최근 2개월)을 내보내는 API 가 없어서다. 장성우 제안대로 데모 전에는 이미 있는 상한선 칸에 문장으로 넣는다. engine 문장화는 상한선을 「말하지 않을 것」으로 받으므로 문장화 결과에 이 항목이 나오지 않는다

## 다음 할 일 / 범위 밖
- C2 v1(11/13): 화면에서 배지처럼 구조로 보여 줘야 하면 argument 에 `expected_gaps[]` {kind, item, status, reason} — 동결 문서 · C2 README · 프론트 argument 스키마(정우현 !160)를 같은 MR 에서, 정호성 · 정우현 동의 뒤
