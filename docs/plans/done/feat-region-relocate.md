# feat/region-relocate — 기존 기사 위치를 행정동으로 바꾸는 명령

- Jira: S15P31C108-210 · PRD: 7.6 · 묶음/단위: P3-8

## 완료 조건
- [x] `region-load --relocate`: 법정동 `kr-<10>` 인 기사(dev 553건)를 저장된 주소로 SGIS 에 다시 찍어 행정동 `kr-<8>`(없으면 시군구 `kr-<5>`)로. 좌표 · 주소는 그대로
- [x] 기본 시험 실행, `--apply` 로 커밋. 바꾼 · 못 찾은 건수. SGIS 키가 없으면 아무것도 바꾸지 않음
- [x] 가짜 SGIS · PostGIS 테스트, README · contracts/p3 v0.10

## 진행
- 2026-11-03: 시작. !109(위치) 병합 뒤. dev DB `news_event` 위치: 건물 주소 471(모두 법정동 `kr-<10>`) · 행정 중심 2,322(법정동 82 · 시군구 `kr-<5>` 871 · 시도 `kr-<2>` 1,369) · 없음 685 — 바꿀 것은 법정동 553건, 모두 주소가 있다
- 2026-11-03: 결정 — 추출을 다시 돌리지 않고 저장된 주소만 쓴다. 좌표를 바꾸지 않고 place_id 만 바꾼다(lab 적재도 같은 SGIS 로 찍은 점). 주소를 그대로 먼저 찾고(행정 주소는 시도를 붙여야 SGIS 가 찾는다) 그다음 건물 주소 검색어 후보. 못 찾은 기사는 그대로 둔다
- 2026-11-03: `pnpm engine:test` 새 relocate 테스트 2개, `tests_postgres/test_region_store.py` 5개(시험 실행 되돌림 · apply · 좌표 그대로 · 키 없음)

## 다음 할 일 / 범위 밖
- EC2 `collector.env` 에 `SGIS_KEY` · `SGIS_SECRET` 을 넣은 뒤(사람): `sudo issueatlas-collect region-load --relocate` 시험 실행 → 건수 확인 → `--apply`
