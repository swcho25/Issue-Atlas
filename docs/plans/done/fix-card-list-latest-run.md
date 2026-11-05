# fix/card-list-latest-run — 카드 목록 근거 상태를 같은 조건의 최근 실행으로

- Jira: S15P31C108-264 · PRD: FR-A (카드 목록 근거 n/4) · 묶음/단위: P5 — 근거 상태 전수 점검(11/5) 후속, 장성우 합의

## 완료 조건
- [x] `GET /v1/places/{id}/cards` 근거 상태 = 등록된 `card_evidence_status` → 없으면 같은 place · 카드 · card_version · 기간의 최근 실행(argument_run) 근거 수요표 → 없으면 not_collected
- [x] 다른 카드 판 · 기간 · 지역 실행은 섞지 않는다. 질문 실행은 지금처럼 등록된 상태만 읽는다 — `PlaceCardsIntegrationTest.listUsesLatestRunOfSameCardVersionAndPeriodWhenNothingIsRegistered`
- [x] 응답 모양 그대로, C2 README 「카드 목록 구현」 · 변경 이력
- [ ] 개발 서버에서 여수 C1 카드 목록이 질문 결과와 같은지 — 병합 · 배포 뒤

## 진행
- 2026-11-05: 12건 점검에서 카드 목록이 모두 0/4. `card_evidence_status` 를 채우는 코드가 없다(마이그레이션의 ID 변경뿐). 장성우 요청대로 등록 상태 우선 → 최근 실행 → not_collected. 카드 목록만 새 조회(`findCardsForList`)를 쓰고, 질문 실행의 `findCards` 는 등록 상태만 — 실행이 자기 지난 결과를 읽으면 근거가 사라져도 available 이 남는다

## 다음 할 일 / 범위 밖
- 실행이 한 번도 없는 지역 · 기간은 여전히 0/4. 기본 기간(2023–2025) 12건은 매일 예약 실행 뒤 한 번 돌려 두거나, P3 · P4 가 `card_evidence_status` 를 채우면 해결
