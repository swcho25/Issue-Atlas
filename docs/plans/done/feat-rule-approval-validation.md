# feat/rule-approval-validation — 관리자 승인 전 규칙 검사

- Jira: S15P31C108-194 · PRD: 7.3 · 묶음/단위: P5 승인 검증
- 기준: `feat/approved-card-judgment` (S15P31C108-193) 및 선행 !94·S15P31C108-192.

## 완료 조건
- [x] 관리자 승인 API가 주 지표 규칙을 승인과 같은 트랜잭션에서 검증한다.
- [x] 지원하지 않는 `rule_id`, 모르는 `when`, 잘못된 임계값은 400 INVALID_REQUEST로 승인되지 않는다.
- [x] 유효한 C1·A3 승인과 기존 SQL 저장 검사가 유지되고 백엔드 테스트·빌드가 통과한다.

## 진행
- 2026-11-02: 승인 전 검사 단위 시작.
- 2026-11-02: 승인 검증 통합 테스트, `pnpm check`, `pnpm backend:build`, `git diff --check` 통과.

## 다음 할 일 / 범위 밖
- SQL `approve_card()` 직접 호출은 Java 실행기 목록을 알 수 없으므로 이번 API 검사를 거치지 않는다. 운영 승인 경로는 관리자 API로 제한하고, 기존 seed는 알려진 두 규칙을 포함한다.
