# feat/region-place-check — 적재 전 장소 주소로 기사 지역 확인 (MR 2b-1)

- Jira: S15P31C108-203 · PRD: 7.6 · 묶음/단위: P3-6 · P3-7

## 완료 조건
- [x] 주소 API(JUSO) 클라이언트 · 장소 확인(장소 사전 · 이름 앞 시군구 · 기사 시군구로 좁히기), 법정동 코드(옛 29 · 46 / 새 12) → 시군구 · 읍면동
- [x] `region-load` 가 적재 전에 장소로 지역을 확인: 구추측 → 장소가 한 구면 그 구(lab check_gu), 통합시 전체 → 장소가 한 시군구면 그곳(p8.2)
- [x] 키(`JUSO_SEARCH_KEY`)가 없거나 키 오류면 확인을 건너뛰고 결과 `place_check.off` 에 남김. `.env.example` 키 이름
- [x] 가짜 주소 API 로 테스트, README

## 진행
- 2026-11-03: 시작. MR 3(!103)이 추출에서 장소 확인을 빼고 notes(구추측 · SIDO확인 · 장소확인생략)에 남긴 것을 적재 직전에 되살린다. 주소 API 는 DB 트랜잭션 밖에서 부른다
- 2026-11-03: 법정동 코드는 지명 사전(`region_names.tsv`, 통합 뒤 12)으로 읽고, 주소 API 가 통합 전 코드(광주 29 · 전남 46)를 주면 앞 5자리만 바꾼다(`places.OLD_SGG` 27쌍) — 법정동 코드 파일의 폐지 · 존재 행 3,176쌍이 모두 뒤 5자리가 같았다
- 2026-11-03: 장소 사전(`place_gazetteer.tsv`)은 lab 것을 그대로(사람 검수 전 초안 표시는 머리말에서 뺌 — 2026-10-29 lab 검수 뒤 쓰던 판)
- 2026-11-03: `pnpm engine:test` 새 `test_region_place_check.py` 8개, `tests_postgres/test_region_store.py` 통과

## 다음 할 일 / 범위 밖
- MR 2b-2: 좌표(SGIS) — 장소 → 도로명주소(이 MR 의 `PlaceLookup` 에 `address` 더함) → 건물 좌표, 시군구 · 시도 대표점은 DB `place` 좌표, 기사 읍면동은 좌표가 든 행정동 `kr-<8>`(SGIS 역지오코딩)
- 실제 키로 확인: EC2 `collector.env` 에 `JUSO_SEARCH_KEY`(사람). 주소 API 가 지금 통합 뒤 코드(12)를 주는지 옛 코드를 주는지 한 번 본다
