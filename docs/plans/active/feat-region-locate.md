# feat/region-locate — 적재 때 기사 위치 좌표 · 행정동 정하기 (MR 2b-2)

- Jira: S15P31C108-206 · PRD: 7.6 · 묶음/단위: P3-6 · P3-8

## 완료 조건
- [x] SGIS 클라이언트(`.env` `SGIS_KEY` · `SGIS_SECRET`): 주소 → 좌표 · 법정동 · 행정동 코드
- [x] 위치 정하기(lab Locator): 장소 도로명주소 → 건물 좌표(address), 못 찾으면 장소 · 기사 읍면동 · 시군구 중심(admin_centroid), 시군구 없는 기사는 DB 시도 대표점, 전국 · 보류는 none
- [x] 기사 `place_id`: 행정동 `kr-<8>`(SGIS 행정동 코드 → `place_code_map` `sgis`), 없으면 시군구 `kr-<5>`. 법정동 `kr-<10>` 은 더 만들지 않는다
- [x] `region-load` 가 위치를 저장(새 위치가 none 이면 이미 있는 위치는 그대로), 키가 없으면 건너뜀. 가짜 SGIS 테스트 · README · contracts/p3 v0.9

## 진행
- 2026-11-03: 시작. !108(장소 확인) 병합 뒤. 결정 — 행정동은 따로 역지오코딩하지 않는다: SGIS 지오코딩 결과에 행정동 코드(`adm_cd`, 8자리)가 함께 오고, V0019 의 `place_code_map(sgis)` 에 통합 전(광주 24 · 전남 36) · 뒤(12) 코드가 다 있어 바로 `kr-<8>` 로 잇는다
- 2026-11-03: 시도 대표점은 lab 의 `sido_points.tsv` 대신 DB `place`(level sido, V0018 — 같은 점)에서 읽는다. 주소 API · SGIS 호출과 DB 참조 읽기는 적재 트랜잭션 밖에서
- 2026-11-03: `pnpm engine:test` 새 `test_region_locate.py` 7개, `tests_postgres/test_region_store.py` 4개(좌표 저장 · none 이면 유지, DB 참조 읽기)

## 다음 할 일 / 범위 밖
- EC2 `collector.env` 에 `SGIS_KEY` · `SGIS_SECRET`(사람). 실제 키로 시험 실행 — 결과 `locate.precision` 분포가 lab 적재(건물 471 · 중심 2,322 · 없음 685 / 3,478)와 비슷한지
- 이미 넣은 3,478건의 법정동 `kr-<10>` 을 행정동으로 바꾸려면 위치만 다시 정하는 명령(추출 결과 다시 적재)이 필요 — 모델 서버 · 키가 생긴 뒤
