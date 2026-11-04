# feat/place-boundary-api — 시군구 · 행정동 경계를 화면에 내보내는 C2 API

- Jira: S15P31C108-238 · PRD: FR-A1 · 묶음/단위: P3 · S1-18a (지도 테두리 · 행정동 고르기)

## 완료 조건
- [x] `GET /v1/places/{place_id}/boundaries` 가 시군구 하나 + 그 행정동 경계를 GeoJSON FeatureCollection 한 번에 돌려준다 (C2 새 엔드포인트, 동결된 응답 칸은 그대로)
- [x] 행정동을 주면 그 행정동 하나, 경계 없는 place(측정소 · 시도)는 빈 목록, 없는 place 는 404
- [x] contracts/c2 스키마 · 예시 · openapi 를 더하고 응답이 스키마와 맞는다 (테스트)
- [x] 로그인 없이 조회된다 (공개 경로)
- [x] dev 에서 실제 응답 크기 · 시간을 잰다 — 여수시 175KB(28곳) · 광산구 35KB · 북구 27KB · 남구 17KB · 서구 14KB · 동구 10KB, DB 조회 약 5 ms

## 진행
- 2026-11-04: 시작. !131 리뷰(장성우) 제안대로 기존 응답에 칸을 더하지 않고 새 엔드포인트, 시군구 + 행정동 한 번에
- 2026-11-04: GeoJSON 은 PostGIS `ST_AsGeoJSON(…, 5)` 결과를 `@JsonRawValue` 로 그대로(EvidenceResponse.locator 와 같은 방식). 예시는 좌표를 줄인 것이라 테스트는 스키마 · 순서 · 건수로 본다
- 2026-11-04: 병합된 `feat-place-boundaries` 계획 파일을 done 으로 옮김(dev 적용 체크)

## 다음 할 일 / 범위 밖
- 화면(18a)에서 테두리 그리기 — 프론트
- 응답 압축: backend 에 `server.compression` 이 없다. 여수 175KB 는 gzip 이면 크게 줄 것 — Cloudflare 앞단 압축 여부 확인 뒤 필요하면 별도 MR
