# fix/lofin-source-row — 세출 출처 행을 넣어 세출 기존 대응이 근거가 되게 한다

- Jira: S15P31C108-234 · PRD: 7.3 근거 충실도 · 묶음/단위: P2 · P7

## 완료 조건
- [x] Flyway 마이그레이션이 `lofin` 출처 행을 세출 수집기와 같은 이름 · 기관 · 이용 조건 · 저장 범위로 넣고, 등급은 B 로 채워진다
- [x] 이미 `lofin` 행이 있는 DB 에서는 아무것도 바꾸지 않는다
- [x] 세출 수집기를 다시 돌려도 출처 계약 검사(SOURCE_CONTRACT_MISMATCH)에 걸리지 않는다
- [x] backend 테스트 · engine 테스트가 통과한다

## 진행
- 2026-11-04: 시작. 개발 DB `local_expenditure` 38,849행은 `job_run_id` 가 모두 null(옛 수집기) · `source` 에 `lofin` 없음 · `existing_response` 의 lofin 후보 627건. S15P31C108-232(V0039) 의 B 가 적용될 행이 없어 수집기를 다시 돌리는 대신 마이그레이션으로 넣는다
- 2026-11-04: V0040 · `SourceGradeMigrationTest` 1개 추가(두 번 돌려도 그대로, B). engine `test_lofin_store` 는 V0039 · V0040 을 함께 적용해 미리 넣은 행에서 수집 → 재수집이 멈추지 않는지 본다(4개 통과). `QuestionApiTest` 의 `lofin()` 도우미는 미리 있는 행을 덮어쓰게 바꾸고, 재실행 지표 시험은 세출 근거가 붙어 채운 칸이 3 → 4 로 바뀐 것을 반영. backend 172개 통과

## 다음 할 일 / 범위 밖
- 배포 뒤 개발 DB 에서 `lofin` 행 등급 B, 여수 · 광주 질문에 세출 기존 대응 근거가 붙는지 확인
