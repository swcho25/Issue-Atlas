# 백엔드 패키지 구조와 개발 컨벤션

## 결정

최상위를 기능(도메인)으로 나누고 그 안을 역할별로 나눈다. 패키지 루트는 `com.c108.issueatlas`다. 지역·근거처럼 함께 변경되는 업무를 기준으로 묶으며 테이블 하나마다 도메인을 만들지 않는다.

```text
com.c108.issueatlas
├── BackendApplication
├── common
│   ├── config
│   └── exception
├── place
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   └── dtoㄱ
└── evidence
    ├── controller
    ├── service
    ├── repository
    ├── entity
    └── dto
```

place·evidence는 구조를 설명하는 예시다. 기능 구현 시 필요한 패키지만 만들고 빈 디렉터리나 사용하지 않는 기반 클래스를 미리 만들지 않는다. 도메인명은 업무 용어에 맞춰 소문자로 쓴다.

## 역할과 의존 방향

| 패키지 | 역할 | 예시 |
| --- | --- | --- |
| controller | HTTP 요청 검증, 상태 코드, 응답 DTO 변환 | PlaceController |
| service | 업무 로직과 트랜잭션 경계 | PlaceService |
| repository | DB 조회와 영속화 | PlaceRepository |
| entity | 영속 데이터와 상태 변경 규칙 | Place |
| dto | API 요청·응답 데이터 | PlaceCreateRequest, PlaceResponse |
| common/config | 여러 기능에 적용되는 프레임워크 설정 | 웹 설정 |
| common/exception | 공통 예외 처리 기반 | 전역 예외 처리기 |

호출 방향은 `controller → service → repository`다. Controller는 Repository를 직접 사용하지 않는다. Service는 Controller에 의존하지 않고 Repository는 Service·Controller에 의존하지 않는다. 순환 의존은 금지한다.

다른 도메인의 기능이 필요하면 공개된 Service를 통해 협력하고, 다른 도메인의 Controller·Repository를 직접 호출하지 않는다. 기능이 늘어 순환이 발생하면 책임 분리와 호출 흐름을 먼저 조정한다. common은 실제로 여러 도메인이 공유하는 코드만 담고 특정 도메인 업무 로직은 넣지 않는다.

## 개발 규칙

- 의존성은 생성자로 주입한다. 생성자가 하나면 불필요한 `@Autowired`를 붙이지 않는다.
- 요청·응답 DTO는 기본적으로 Java `record`를 사용한다. 요청에는 입력 검증을 선언하고 Controller에서 `@Valid`로 적용한다.
- JPA Entity를 Controller의 응답으로 직접 반환하지 않는다. 응답 DTO는 API에 공개할 필드만 담으며 C2 계약과 맞춘다.
- 트랜잭션은 Service의 업무 단위에 선언한다. 조회 전용은 `@Transactional(readOnly = true)`, 변경은 쓰기 트랜잭션으로 구분한다.
- Controller는 HTTP 처리에 집중하고 업무 판단을 Service에 둔다. 변환이 단순하면 별도 Mapper 계층을 강제하지 않는다.
- 패키지는 소문자, 클래스는 역할이 드러나는 이름을 사용한다. Entity에 일괄 setter를 두지 않고 필요한 상태 변경 메서드를 둔다.
- 테스트 패키지는 대상 코드의 패키지 구조를 따른다. 업무 로직은 단위 테스트, HTTP 입력·응답은 웹 테스트, DB 동작은 실제 PostGIS 통합 테스트로 확인한다.

## 검사

`ArchitectureTest`는 기존 순환 의존·필드 주입·표준 출력·Controller의 Repository 직접 사용 검사에 Service와 Repository의 역방향 의존 검사를 더한다. 구현 클래스가 아직 없는 계층은 검사 대상을 비워 둘 수 있다. DTO 반환 형식·트랜잭션 위치·다른 도메인 접근의 세부 규칙은 코드 리뷰에서도 확인한다.

```sh
# DB가 필요 없는 구조 검사
node scripts/gradle.mjs test --tests com.c108.issueatlas.ArchitectureTest

# Docker가 필요한 전체 백엔드 검사
pnpm backend:test
pnpm backend:build
```

Java 포맷은 [포맷 규칙](backend-format.md), 공통 오류는 [오류 계약](../contracts/http-errors/README.md)을 따른다. C2 성공 응답과 Flyway 핵심 테이블은 별도 작업이다.
