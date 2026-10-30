# perf/airkorea-refine-monthly-only — 에어코리아 정제 결과를 월별로만 저장한다

- Jira: S15P31C108-115 · PRD: — · 묶음/단위: P2

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `refine --db` 가 에어코리아 확정 시간값(`airkorea_final` · `H`)을 지금처럼 시간마다 검증하고 최신본을 고른 뒤, `normalized_record` 에는 넣지 않고 측정소 × 지표 × 월 집계만 `air_monthly` 표에 저장한다. 칸은 지금 `air_monthly` 와 같고 보류 시간 수를 더한다. KOSIS · 측정소 메타는 지금처럼 `normalized_record` 에 저장한다
- [x] Flyway V0009: `air_monthly` 를 materialized view 에서 표로 바꾸고, `normalized_record` 에 이미 있는 에어코리아 시간 행을 지운다 (다음 정제 때 월별로 다시 만들어진다)
- [x] tests_postgres: 월 경계 · 결측 · 75% · 확정이 잠정을 대신 · 한 달이 여러 묶음에 걸침 · 다시 돌려도 같은 결과 · `normalized_record` 에 에어코리아 시간 행 없음
- [x] 시험 DB(2024-01)로 월평균이 지금 `air_monthly`(뷰)와 같은지, 저장 크기 전후를 재서 이 파일에 남긴다
- [x] P2 계약 v0.4 를 고치고 `pnpm check` · tests_postgres · backend test 를 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-27: 시작
  - 계기: 에어코리아 시간 단위 정제 결과는 행당 약 2.4KB(시험 DB 98,248행 = 227MB), 3년 치(약 347만 행)면 약 8.4GB. 카드 · P3 · P4 는 월 단위 값(S15P31C108-114 `air_monthly`)을 쓴다
  - 결정: 원본(`raw_record`)과 수집기는 바꾸지 않는다 — 원본은 받은 그대로 시간 단위로 두고, 월평균의 근거는 원본으로 따라간다
  - 결정: 시간마다 검증(결측 · 충돌 · 잠정/확정 판)과 하루 묶음 처리(S15P31C108-111)는 그대로. 묶음마다 월 합계(합 · 유효 수 · 최솟값 · 최댓값 · 잠정 · 보류 수)를 더해 두고 정제가 끝나면 월별 표에 쓴다 — 메모리에는 하루 치 장부와 월 합계(약 4,800칸)만
  - `normalized_record` 는 「원본 한 행 = 정제 한 행」(content_hash FK)이라 월 행은 넣을 수 없다. 월별 값은 `air_monthly` 표에 둔다
- 2026-10-27: 구현
  - V0009: `air_monthly` materialized view 를 지우고 같은 칸 + `held_hours` 의 표로(기본 키 station_code · indicator_id · month_start, 75% 규칙 CHECK). `normalized_record` 의 `airkorea_final` 행을 지운다
  - `store.py`: 묶음마다 정제한 뒤 원본 source_id 가 `airkorea_final` 인 레코드는 저장하지 않고 `AirMonthly` 에 더한다. 관측 칸(obs_key)마다 보류가 아닌 최신본이 있으면 그 값(결측이면 유효 시간에서 빠짐), 없으면 보류 시간. 값은 Decimal 로 더한다. 모든 묶음이 끝나면 한 트랜잭션으로 `DELETE` 뒤 `INSERT`. 실행 결과에 `air_monthly` · `air_unplaced`. 단위가 한 달 안에서 다르면 `AIR_UNIT_MISMATCH`
  - tests_postgres: `test_air_monthly.py` 를 표 기준으로 고침 +3 — 보류 시간(같은 dedup_key 충돌 → held_hours 1, 평균에서 빠짐), 시각을 읽을 수 없는 레코드(air_unplaced), 다시 돌려도 같은 결과. 한 달이 하루 묶음 31개에 걸치는 것은 1월 테스트가 덮는다. `normalized_record` 에 에어코리아 행이 없는 것도 확인. fixture 에 V0009
  - 시험 DB 복사본(2024-01, 98,248행): V0008 뷰로 낸 월별 132행과 새 정제로 쓴 표 132행이 모두 같다(소수 10자리)

    | | 예전(시간 정제 행 + 뷰) | 새(월별 표만) |
    | --- | --- | --- |
    | `normalized_record` | 98,248행 · 227MB | 40행(KOSIS 18 · 측정소 22) · 168KB (VACUUM FULL 뒤) |
    | `air_monthly` | 뷰 | 132행 · 88KB |
    | `refine --db` 시간 | 132.5 s | 49.3 s |
  - 계약: P2 v0.4 「월별 집계」(저장 규칙 · `held_hours` · 근거는 원본으로), contracts 표, DB 계약 이력 v0.1.6, engine README
  - 마무리: `pnpm check:all` 9단계 · `pytest tests_postgres` 36건 통과

## 다음 할 일 / 범위 밖
- 일평균 · 기준 초과 일수
- 시군구 단위 집계 — 측정소 ↔ 시군구 연결은 P3
- 증분 정제
