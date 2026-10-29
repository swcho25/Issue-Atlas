# feat/place-list-api — 지역 선택 화면이 쓰는 지역 목록 API

- Jira: S15P31C108-129 · PRD: 8장 API ① · 묶음/단위: P7

## 완료 조건
- [x] Flyway V0011이 광주 5구·여수시 6곳과 KOSIS 옛·새 지역 코드를 place·place_code_map에 넣는다
- [x] GET /v1/places 가 C2 place-list 스키마에 맞는 응답을 돌려준다 (예시 place-list.json과 같은 내용)
- [x] 백엔드 테스트가 응답 모양과 6곳·코드 12개를 검사한다

## 진행
- 2026-10-28: 시작. 로컬·서버 DB 의 place 표가 비어 있어 지역 6곳을 마이그레이션으로 넣는다. place_id·코드는 C2 예시(place-list.json)와 같게 둔다
- 2026-10-28: place 는 geography 칸이 있어 JPA 엔티티 대신 JdbcClient 로 읽는다. PlaceApiTest 는 응답을 C2 예시와 STRICT 비교한다. FoundationMigrationTest 가 place 를 비우므로 다른 컨텍스트(@AutoConfigureMockMvc)에서 돈다
- 2026-10-28: 로컬 bootRun(8081)에서 로그인 뒤 GET /v1/places → 예시와 같음(6곳 · 코드 12개), 로그인 없이 401. `pnpm check` PASS

## 다음 할 일 / 범위 밖
- 지도 점 API(⑤ GET /v1/observations): 측정소를 place(level station)에 넣는 일부터
