# backend 규칙

Spring Boot 4.1 · Java 21 · Gradle 9 · Spring Data JPA · Flyway · PostgreSQL 17 + PostGIS 3.5 · springdoc.

## 구조
- 패키지 루트 `com.c108.issueatlas`. 최상위는 도메인(place·evidence 등), 내부는 controller·service·repository·entity·dto로 나눈다. 필요한 패키지만 만든다
- 호출 방향은 controller → service → repository. Service는 Controller에, Repository는 Service·Controller에 의존하지 않는다
- common/config·common/exception에는 여러 도메인이 실제로 공유하는 코드만 둔다. 상세: [백엔드 구조·컨벤션](../docs/backend-architecture.md)
- 생성자 주입을 사용한다. 요청·응답 DTO는 기본 record, Entity는 API 응답으로 직접 반환하지 않는다
- 트랜잭션은 Service의 업무 단위에 둔다. 조회는 readOnly=true, 변경은 쓰기 트랜잭션으로 구분한다
- API 는 PRD 8장 API 5종 + 보조 API. 응답 구조는 `contracts/`(계약 C2)와 같아야 한다
- Swagger UI: `/swagger-ui.html`

## 오류 응답
- common/exception/ApiExceptionHandler가 MVC 오류를 ProblemDetail(application/problem+json)로 변환한다
- @Valid 요청 DTO를 사용하고 없는 리소스는 ResourceNotFoundException으로 처리한다. 내부 예외 메시지는 응답에 노출하지 않는다
- 계약과 코드 표: [공통 HTTP 오류 v0.1](../contracts/http-errors/README.md). 성공 응답은 C2 협의 후 정한다

## DB
- 스키마는 Flyway 마이그레이션(`src/main/resources/db/migration`)으로만 바꾼다. `ddl-auto` 는 `validate`
- 파일 이름 `V<4자리 번호>__<설명>.sql`. 이미 병합된 마이그레이션은 고치지 않고 새 번호로 추가한다
- 시각은 UTC 로 저장한다(`TIMESTAMPTZ`). 좌표는 WGS84
- 수집·지역 테이블 V0002 계약: [DB 기반 v0.1](../contracts/database/README.md). 새 FK·CHECK 변경 시 실제 PostGIS 통합 테스트를 함께 갱신한다

## 테스트
- 통합 테스트는 Testcontainers 로 실제 PostGIS(`postgis/postgis:17-3.5-alpine`)에서 돈다. H2 로 대체하지 않는다
- Docker 가 꺼져 있으면 테스트가 실패한다. 그때는 실패 원인을 그대로 보고한다
- 구조 규칙은 `ArchitectureTest`(ArchUnit)에 있다: 기능 패키지 순환 금지, 필드 주입 금지, System.out 금지, 컨트롤러의 리포지토리 직접 사용 금지. Service·Repository의 역방향 의존 금지도 검사한다

## 포맷
- Spotless + Google Java Format(AOSP): 공백 4칸. 버전은 build.gradle에 고정한다
- 검사 `pnpm backend:format:check`, 자동 수정 `pnpm backend:format`. src 아래 Java만 대상이며 Docker는 필요 없다
- pnpm check와 Gradle check/build에서 검사한다. 상세: [Java 포맷 규칙](../docs/backend-format.md)

## 검사 (루트에서)
`pnpm backend:test` · `pnpm backend:build`
