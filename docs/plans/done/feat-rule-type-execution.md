# feat/rule-type-execution — 규칙 종류별 순수 판정 실행기

- Jira: S15P31C108-192 · PRD: 7.3 · 묶음/단위: P5 판정 실행기
- 기준: `feat/judgment-thresholds` (!94). 승인본을 질문 API에 연결하는 일은 후속 단위로 분리한다.

## 완료 조건
- [x] `rule_id`별 실행기가 규칙 구조와 조건 이름을 검증한다.
- [x] C1 순이동과 A3 공통 측정소 첫해·끝해 차이를 승인 규칙대로 계산한다.
- [x] 경계 사례 단위 테스트와 바뀐 백엔드 검사가 통과한다.

## 진행
- 2026-11-02: !94의 C1·A3 규칙 및 seed를 기준으로 실행기 작업을 시작한다.
- 2026-11-02: 순수 실행기 2개와 경계 사례 테스트 추가. `pnpm check`의 backend format·test, engine lint·test, harness 통과. 검증 보강 뒤 대상 단위 테스트 재통과.
- 2026-11-02: `pnpm backend:build` 통과.
- 2026-11-02: 최신 `origin/develop` 병합 충돌 없음. 병합 상태에서 `pnpm check:all` 통과, MR !99 검토 준비.

## 다음 할 일 / 범위 밖
- 승인본 조회·월→연 집계·QuestionService 연결·관리자 승인 전 검사는 별도 구현 단위에서 처리한다.
