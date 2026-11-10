# feat/source-reliability-grade — 출처 등급을 정해 근거가 붙게 한다

- Jira: S15P31C108-232 · PRD: 7.3 근거 충실도 · 묶음/단위: P2 · P7

## 완료 조건
- [x] 출처 등급 기준(A 공식 측정·통계 원자료 · B 기관 발표·공시 행정 자료 · C 언론 보도)과 출처별 값이 계약 문서에 있다
- [x] Flyway 마이그레이션이 이미 있는 출처 행의 빈 등급을 채우고, 나중에 수집기가 넣는 출처 행도 등급이 비면 같은 값으로 채운다
- [x] 등급을 일부러 비운 출처(테스트 lofin null)는 여전히 근거가 안 붙는다
- [x] backend 테스트가 통과한다

## 진행
- 2026-11-04: 시작. 개발 DB 출처 7개 모두 등급 null, `lofin` 행 없음(세출 수집기가 돌면 생긴다). 수집기는 등급 없이 `ON CONFLICT DO NOTHING` 으로 넣어서, 마이그레이션 UPDATE 만으로는 뒤에 생기는 행이 비게 된다 → 값은 함수 하나(`source_default_grade`)에 두고 UPDATE + BEFORE INSERT 트리거로 채운다. 수집기 코드(P1)는 건드리지 않는다
- 2026-11-04: 등급은 박준우가 정함(대표 결정 기다리지 않음). 기준은 「자료를 누가 만들었는가」 하나
- 2026-11-04: V0039 · `SourceGradeMigrationTest` 3개 추가. `QuestionApiTest` 의 `lofin(null)` 도우미는 넣은 뒤 등급을 다시 비우게 바꿔 「등급 없는 후보는 보류」 시험을 그대로 둔다. backend 테스트 171개 통과

## 다음 할 일 / 범위 밖
- 운영 DB 의 출처 행 상태는 확인 못 함(권한). 배포 뒤 `SELECT source_id, reliability_grade FROM source` 로 확인
- 개발 DB 에는 `lofin` 행이 아직 없다. 세출 수집기를 한 번 돌리면 트리거가 B 로 채운다
