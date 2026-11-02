# fix/expenditure-latest — 세출 최신본 뷰와 수집 기록

- Jira: S15P31C108-173 · PRD: FR-F5 · 묶음/단위: P8-27

## 완료 조건
- [x] 같은 사업의 금액이 바뀐 파일을 다시 받아도 최신본 뷰에는 한 줄만 나온다 (V0026, `test_lofin_store`)
- [x] 세출 수집이 source · source_spec 에 등록되고 실행마다 job_run 을 남긴다

## 진행
- 2026-11-02: 시작. `expenditure_id` 가 금액까지 포함한 행 지문이라 다시 받은 파일의 바뀐 사업은 새 행 · 옛 행이 같이 남는다(`DO NOTHING`)
- 2026-11-02: 사업 단위 자연키(연도 · 자치단체 · 사업명 …)는 한 파일 안 동명 사업을 잘못 합칠 수 있어 쓰지 않음. 대신 파일 = 실행 단위로 보고, 다시 넣을 때 그 파일의 행에 실행 ID 를 찍는다(`DO UPDATE SET job_run_id`). 최신본 뷰 = 회계연도마다 마지막 실행의 행. 기존 `expenditure_id` · 칸은 그대로라 기존 대응 추출(-136)과 부딪히지 않는다
- 2026-11-02: 출처 `source_id = lofin` — backend 가 `existing_response.origin` 으로 출처 등급을 찾으므로 같은 이름. 수집 명세 `lofin_expenditure_gwangju_yeosu`(`file` · `existing_responses`)
- 2026-11-02: Flyway 번호 V0024 → V0026. 장성우 !79(V0024 시군구 place_id kr-) · !81(V0025 observation view)과 겹쳤다. develop 에 outOfOrder 가 없어 이 MR 은 !79 · !81 병합 뒤에 병합해야 한다(SP10 세션에서 알림)
- 2026-11-02: 검사 — backend format · `pnpm backend:test` 통과(Flyway V0026 포함), engine lint · test 435, tests_postgres 46 전부 통과

## 다음 할 일 / 범위 밖
- **병합 순서: 장성우 !79 · !81 병합 뒤에** (Flyway outOfOrder 없음)
- 장성우: 기존 대응 추출이 `local_expenditure_latest` 를 읽게, `origin_ref` 를 사업 단위 키로(옛 판 후보 `is_current = false`) — 계약 README 「쓰는 쪽 메모」
- 개발 서버: V0026 배포 뒤 2023–2025 파일을 한 번씩 다시 넣으면 실행 기록이 생긴다(넣지 않아도 뷰는 그 해 모든 행)
- `source.reliability_grade` 를 lofin 에 정하는 일은 범위 밖(출처 등급 결정)
