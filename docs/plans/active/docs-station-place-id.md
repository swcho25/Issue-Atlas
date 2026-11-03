# docs/station-place-id — 측정소 place_id kr- 형식 (제안 → V0032)

- Jira: S15P31C108-198 · MR !104 · 기준: 11/4 동결 문서 「아직 안 정한 것」 · !97 리뷰(P3 가 11/6 전 제안)

## 완료 조건
- [x] contracts/p3 「측정소 ID」: 형식 `kr-<부모 시군구 5자리>-s<에어코리아 측정소 코드>`, 만드는 법 · 앞자리 규칙 · 겹치지 않음 · 행정동을 넣지 않은 까닭 · 옮긴 측정소, 22곳 표
- [x] 받는 쪽 리뷰 — 장성우(P1 · P7) 동의 2026-11-03
- [x] V0032: 측정소 22곳 새 ID 로 복사 → `place_code_map` · 참조 표 · 저장된 실행 결과 옮김 → 옛 행 지움, 옛 형식이 남으면 멈춤. V0017 은 그대로
- [x] 계약 예시 3개 · observation · database · C2 · freeze 문서, backend 테스트 5개를 새 ID 로
- [x] `pnpm backend:test` 통과 — 142개 (V0032 를 실제 PostGIS 에 적용)

## 진행
- 2026-11-03: 시작. 결정(정우현) — 시군구까지만 담는 `kr-<5>-s<코드>`. 행정동(`kr-<8>-s…`)은 22곳 역지오코딩과 경계 자료가 필요해 뺀다
- 2026-11-03: 장성우 리뷰 — 형식 동의(P1 · P7). C2 스키마에 place_id 형식 검사가 없어 그대로 통과, backend 는 `observation.station_id` → `place` 조인만 써서 코드 변경 없이 마이그레이션만, engine(P1 · P2)은 `station_code` 만 써서 바꿀 곳 없음. 실제 이전은 여천동 1곳(같은 여수시) — 다른 시군구로 옮긴 측정소 0곳. 처음엔 「11/6 데모 뒤」를 부탁
- 2026-11-03: 결정(정우현 · 장성우) — 11/4 동결 전에 지금 바꾼다. 모든 원격 브랜치의 frontend 에 측정소 ID 를 쓰는 코드가 없어 맞출 곳이 없고, 늦출수록 저장된 실행 결과 · 프론트 코드에 옛 ID 가 쌓인다. 이 MR(!104)에 마이그레이션까지 담는다
- 2026-11-03: `pnpm backend:test` 142개 통과(Testcontainers PostGIS 에 V0001 ~ V0032 적용) — `StationPlaceSeedTest` · `PlaceParentsTest` · `ObservationApiTest` · `ObservationViewTest` · `QuestionApiTest` 포함

## 다음 할 일 / 범위 밖
- 병합 뒤 P5 · frontend 에 새 측정소 ID 알림
