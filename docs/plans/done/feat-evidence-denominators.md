# feat/evidence-denominators — 근거 수요표 분모 칸 연결과 빈 칸 이유 표시

- Jira: S15P31C108-249 · PRD: FR-B (근거 수요표) · 묶음/단위: P5-23

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 여수 × C1 × 2023–2025 실행의 근거 수요표 분모 칸이 `available` · 1건이고, `data.denominators` 에 주민등록인구(SP10 `population_registered_total`, 등급 A) 근거가 있다 — `QuestionApiTest.c1DenominatorIsLinkedFromRegisteredPopulation`
- [x] 카드 설계도의 분모 지표에 질문 기간 관측 행이 없으면 분모 칸은 `not_collected` 이고 이유 문장이 있다 — `c1RuleJudgesYearSumsOfMonthlyNetMigration`
- [x] 근거 수요표에서 `available` 이 아닌 칸은 `reason` 이 null 이 아니다 (회사 플랜 Goal ① 「없는 이유」) — `MissingReasonTest`
- [x] backend 통합 테스트 통과 (`pnpm check` backend format · test)
- [ ] 개발 서버 API 로 여수 응답 확인 — 병합 · 배포 뒤 Jira 코멘트에 남긴다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-11-05: 시작. 개발 API 로 여수 · 동구 C1 을 돌려 보니 분모 · 문서 칸이 `not_collected` · `reason` null. 판정(CardJudge)이 두 목록을 늘 빈 목록으로 넘기고, 등록된 확보 상태(not_collected)를 이유 없이 그대로 냄. 관측 view 에는 SP10 `population_registered_total` 2023–2025 연말 값이 여수 · 동구 모두 있음
- 2026-11-05: CardJudge 가 승인본 `evidence.denominators` 지표마다 `QuestionRepository.denominatorEvidence` 로 근거(`ev_den_<md5>`)를 만든다(질문 기간 available 관측 행이 있을 때만). 이름은 승인본 지표 사본 → 지표 사전 `indicator.definition.label` → 지표 ID 순. 판정이 이은 분모 · 문서가 있으면 not_collected 를 available 로 본다(통계와 같은 임시 방식). `available` 이 아닌 줄은 `QuestionService.missingReason` 문장. 한정어(qualifier-0.1)는 분모를 빼고 세므로 값이 바뀌지 않는다. C2 README 「질문 · 실행 구현」 · 변경 이력에 적음(칸 · 타입 그대로)

## 다음 할 일 / 범위 밖
- 청년(19–39세) 인구 분모 `population_registered_19_39`: 관측 view 에 합계 행이 없고 나이별 21행(`population_registered_19`–`_39`)만 있다. 합계 행을 view 에 더하거나 지표 사전에 나이별 구성(parts)을 적어야 근거로 이을 수 있다. 지금 C1 승인본(v2)의 분모는 전체 인구뿐이라 응답에는 영향 없음
- 문서 칸: 보도자료(normalized_ready kind=press_release)를 판정에 잇는 일은 11/13 「보도자료 → 문서 칸 통합」. 그때 `missingReason` 의 문서 문장을 바꾼다
- 카드 목록(`GET /v1/places/{id}/cards`)의 근거 n/4 는 여전히 `card_evidence_status` 만 읽는다 — 실행 결과와 맞추려면 확보 상태를 쓰는 쪽(P3/P4)이 필요
- 판단하지 않는 실행(blocked · unsupported)은 판정을 돌리지 않아 분모가 비어 있다
