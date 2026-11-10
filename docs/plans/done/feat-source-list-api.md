# feat/source-list-api — 출처 목록 API

- Jira: S15P31C108-157 · PRD: 8장 보조 API `GET /v1/sources` · FR-E2 · 묶음/단위: P7 (L2)

## 완료 조건
- [x] GET /v1/sources 가 출처마다 이름·기관·이용허락·저장 범위·출처 등급을 돌려준다
- [x] 출처별 수집 명세(spec)와 마지막 성공 수집 시각을 함께 준다
- [x] C2 계약에 응답 스키마·예시를 더하고 실제 응답을 스키마로 검증한다

## 진행
- 2026-10-30: 새 표 없이 source · source_spec · job_run 을 읽는다. 마지막 성공은 status ok 인 실행의 종료 시각 최댓값. 등급(reliability_grade)을 아직 정하지 않은 출처는 null
- 2026-10-30: SourceApiTest 2건 PASS(테스트마다 되돌림). 실제 응답을 ajv 로 C2 source-list 스키마 검증 → valid, redocly lint valid

## 다음 할 일 / 범위 밖
- 출처 등급(가이드 시트 탭 3 Q열)을 source 표에 채우는 일. 지금 수집기는 등급을 넣지 않는다
- local_expenditure · press_release 처럼 raw_record 밖 표는 source 표에 행이 없어 목록에 나오지 않는다
