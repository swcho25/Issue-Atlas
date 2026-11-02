# feat/approved-card-judgment — 승인본 기반 질문 판정

- Jira: S15P31C108-193 · PRD: 7.3 · 묶음/단위: P5 실행 연결, P7 리뷰
- 기준: `feat/rule-type-execution` (S15P31C108-192) 및 !94.

## 완료 조건
- [x] 질문 실행이 카드 버전의 승인 규칙·지표 스냅샷을 읽어 `RuleType`을 호출한다.
- [x] 승인된 roll로 월 관측을 연 값으로 묶고 C1·A3의 결과·비교 조건·통계 근거를 C2에 담는다.
- [x] 새 카드의 주 지표·문구를 승인본에서 읽고 legacy 카드는 unsupported로 유지한다.
- [x] 실제 seed 승인본을 쓰는 질문 API 통합 테스트와 백엔드 검사가 통과한다.

## 진행
- 2026-11-02: 규칙 실행기 단위 `ed8f66c`를 기반으로 시작.
- 2026-11-02: 승인본·지표 스냅샷 조회, 연 집계, C1·A3 판정, 승인 문장·정책·그림 자료 연결. 새 C9 카드의 규칙 재사용과 필수 통계 근거 누락을 통합 테스트로 확인.
- 2026-11-02: `pnpm check`(backend format·test, harness, engine lint·test)와 `pnpm backend:build` 통과.
- 2026-11-02: B6 최소 완전 연수 미달을 `run_status = unsupported`, `claim = insufficient`로 정합화. C1·A3 통합 테스트 보강.

## 다음 할 일 / 범위 밖
- 관리자 승인 전 `rule_id`·조건 검증은 다음 단위로 분리한다.
- 측정소 이전·교체 이력은 현재 관측 view에 없어 같은 station_id의 실제 위치 변경을 판별할 수 없다. 역사적 위치 정보가 생기면 `same_boundary` 판정에 연결한다.
