# backend 규칙

Spring Boot 4.1 · Java 21 · Gradle 9 · Spring Data JPA · Flyway · PostgreSQL 17 + PostGIS 3.5 · springdoc.

## 구조
- 패키지 루트 `com.c108.issueatlas`. 기능(도메인)별 패키지로 나눈다 — 구조가 정해지면 이 절을 갱신한다
- API 는 PRD 8장 API 5종 + 보조 API. 응답 구조는 `contracts/`(계약 C2)와 같아야 한다
- Swagger UI: `/swagger-ui.html`

## DB
- 스키마는 Flyway 마이그레이션(`src/main/resources/db/migration`)으로만 바꾼다. `ddl-auto` 는 `validate`
- 파일 이름 `V<4자리 번호>__<설명>.sql`. 이미 병합된 마이그레이션은 고치지 않고 새 번호로 추가한다
- 시각은 UTC 로 저장한다(`TIMESTAMPTZ`). 좌표는 WGS84

## 테스트
- 통합 테스트는 Testcontainers 로 실제 PostGIS(`postgis/postgis:17-3.5-alpine`)에서 돈다. H2 로 대체하지 않는다
- Docker 가 꺼져 있으면 테스트가 실패한다. 그때는 실패 원인을 그대로 보고한다

## 검사 (루트에서)
`pnpm backend:test` · `pnpm backend:build`
