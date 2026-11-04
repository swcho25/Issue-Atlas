# feat/place-boundaries — 시군구 · 행정동 경계(폴리곤)를 DB 에 넣는다

- Jira: S15P31C108-230 · PRD: FR-A1 · 묶음/단위: P3 · S1 (화면 테두리 · 행정동 안 점 거르기)

## 완료 조건
- [x] 우리 시군구 6곳과 행정동 123곳의 경계가 모두 `place_boundary` 에 들어간다 (Flyway 시드, 출처 SGIS 행정구역 경계)
- [x] 각 place 의 대표점(`place.geometry`)이 자기 경계 안에 있다 (테스트)
- [x] engine 에 SGIS 경계를 받아 시드 SQL 을 만드는 명령이 있고, 키가 없으면 아무것도 쓰지 않고 멈춘다
- [ ] dev DB 에 적용된다 (트랜잭션 시험 적용 · 되돌림은 통과. 실제 적용은 병합 뒤 배포 때 Flyway)
- [x] contracts/p3 · database 문서를 고친다 (화면 API 는 다음 MR)

## 진행
- 2026-11-04: 시작. 저장은 DB 표(geography MultiPolygon), 화면용 C2 API 는 다음 작은 MR 로 (P7 · 프론트 리뷰)
- 2026-11-04: SGIS 2025 경계 129곳(행정동 수 V0019 와 같음). 10 m 단순화로 시드 911KB → 246KB. 좌표 변환은 마이그레이션 안 PostGIS(5179 → 4326)
- 2026-11-04: dev DB 시험 적용(되돌림) — 대표점 밖 0, 측정소 22/22 행정동 안, 기사 435/442 자기 행정동 안(7건 1 ~ 11 m)
- 2026-11-04: `pnpm check` 통과(backend 172 · engine 566). `FoundationMigrationTest` 정리 순서에 `place_boundary` 추가

## 다음 할 일 / 범위 밖
- C2 경계 API (`GET /v1/places/{place_id}/boundary` 등) — 계약 변경, P7 · 프론트 리뷰
- 병합 직전 develop 의 마이그레이션 번호가 겹치지 않는지 다시 본다 — develop 에 V0039(출처 등급) · V0040(세출 출처)가 차례로 들어와 V0039 · V0040 → V0040 · V0041 → V0041 · V0042 로 두 번 옮김
- contracts/p3 「아직 없는 것」의 기사 ↔ 행정동 문장이 relocate 적용 전 내용 — 문서 MR 에서 고침
