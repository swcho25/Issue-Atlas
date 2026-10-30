# feat/core-flyway — 수집·지역 기준 테이블 Flyway 마이그레이션 추가

- Jira: [S15P31C108-73](https://ssafy.atlassian.net/browse/S15P31C108-73) · PRD: v4.1 §5.4·7.1 참고 · 묶음/단위: P7 서버 공통

## 완료 조건

- [x] Flyway V0002가 source·source_spec·job_run·raw_record·place·place_code_map 6개 테이블과 필요한 인덱스를 생성한다
- [x] FK·고유 제약·원문 추적·JSON 객체·기간·좌표 제약을 PostGIS 통합 테스트로 확인한다
- [x] content_hash null과 실제 서강동 좌표 및 KOSIS 옛/새 코드 매핑을 저장할 수 있다
- [x] DB 계약·ERD 대비 결정·후속 항목을 문서화하고 변경 영역 검사·백엔드 build 결과를 기록한다

## 진행

- 2026-10-21: 사용자 계속 진행 요청으로 다음 Flyway 작업 시작. 로컬 erd_v0.md와 실제 C1 샘플을 읽고 Jira 중복 확인. 기존 C1·구조·포맷·오류 응답의 미커밋 변경은 별도 작업 트리에 보존하고 origin/develop db18195에서 feat/core-flyway 생성.
- 2026-10-21: 범위 선택 질문과 함께 기반 6개 우선안을 제시. 답변 전 전체 13개를 임의 확정하지 않고 기반 6개의 리뷰 가능한 초안부터 작성한다고 명시. observation·document·카드·권한 테이블은 후속 계약 대조 대상으로 남김.
- 2026-10-21: 담당 장성우·SP 2·활성 스프린트·P7 에픽으로 Jira 생성, 진행 중 전이. 필드·전이 ID는 조회하여 사용하고 저장하지 않음.
- 2026-10-21: V0001은 그대로 두고 V0002에 6개 테이블·FK·UNIQUE·CHECK·조회 인덱스 추가. 원천 spec/run 일치 복합 FK, content_hash·payload null 허용, 측정소 코드 체계 이름 C1 통일, 한국 Point와 GiST, 코드 valid_from 중복의 null도 거절. 실행 중 status/finished_at 모두 null, 종료 시 동시에 채우는 초안은 P1 리뷰 항목으로 명시.
- 2026-10-21: contracts/database/README.md와 docs/database-foundation.md에 저장 경계·ERD 대비 결정·후속 미결 정리. 루트 ERD·샘플은 이동·수정·커밋하지 않음. 운영 DB에는 적용하지 않고 Testcontainers에서만 검증.

- 2026-10-21: 최초 FoundationMigrationTest 11개 중 인덱스 집계 1개 실패. PostGIS 이미지의 다른 스키마에 같은 이름의 place 테이블이 있어 pg_indexes 전체 집계가 2개를 반환함. schemaname=public 조건을 추가하여 검사 범위를 정확히 한정. 기존 인덱스를 제거하거나 검증을 생략하지 않음.
- 2026-10-21: pnpm check 종료 0, backend test 45.8s. 총 16개 테스트 통과(기존 ArchUnit 4 + Spring/PostGIS 부팅 1 + 기반 마이그레이션 11). V0001→V0002 적용·Flyway 재실행 0건, 6개 테이블·공간 인덱스, FK·UNIQUE·CHECK, null hash·payload, 실제 서강동 좌표, 옛/새 코드, 시각 동등성 확인.
- 2026-10-21: pnpm backend:build 종료 0, BUILD SUCCESSFUL(49s). 최종 build에서도 전체 테스트 통과. git diff --check 통과. package.json·pnpm-lock.yaml·backend/build.gradle·frontend·engine 변경 없음. erd_v0.md SHA-256은 작업 전과 동일(EEF9B7721D490CF209B72FCFF720C80E6DB6C21468C65DCD6377412BA22D73F1). 커밋·push·운영 DB 적용 없음.

- 2026-10-22: develop 최신화 — 미커밋 변경을 스크래치 폴더에 백업하고 stash → `git merge --ff-only origin/develop`(db18195 → 3b55cc7, 26커밋) → stash pop. `contracts/README.md` 충돌 1건은 develop 의 공통 HTTP 오류 줄과 이 작업의 DB 기반 줄을 둘 다 남겨 해결. `backend/AGENTS.md` DB 절은 빈 줄을 없애 목록으로 합침. V0002 의 code_system·location_precision·geometry_role(station)·storage_scope 값이 머지된 C1 계약과 같은 것을 확인.
- 2026-10-22: develop 에 Java 포맷 검사가 들어와 `FoundationMigrationTest` 포맷 실패 → `pnpm backend:format` 으로 포맷만 수정(로직 변경 없음).
- 2026-10-22: `E2E_PORT=3110 pnpm check:all`(3100 은 다른 프로젝트 Loki 컨테이너가 사용) — harness·backend format·frontend lint·typecheck·test PASS, frontend e2e FAIL: 이 PC 에 Playwright 브라우저가 없음(ms-playwright 폴더 없음). 이 브랜치는 frontend 를 바꾸지 않음. e2e 에서 멈춰 나머지를 따로 실행: `pnpm backend:build` 통과(ArchitectureTest 6 · BackendApplicationTests 1 · FoundationMigrationTest 11 · ApiExceptionHandlerTest 10, 실패 0), `pnpm engine:lint` 통과, `pnpm engine:test` 91 passed.

- 2026-10-22 finish 재검증: Chromium 설치 상태를 확인하고 `E2E_PORT=63811 pnpm check:all` 전체 통과. harness·Java 포맷·frontend lint/typecheck·단위 테스트 9개·프로덕션 빌드·Chromium E2E 1개·backend build·engine lint/test 91개 통과. backend build/test는 Gradle UP-TO-DATE로 기존 성공 결과를 재사용했다. 구현 커밋 7362eea는 이미 원격과 동일하며 MR은 아직 없다. MR 초안과 Jira 코멘트를 정리하고 push·MR 생성은 사람에게 남긴다.

## 다음 할 일 / 범위 밖

- MR 생성 및 P1·P3 계약 리뷰 후 병합. 검증 결과 갱신 커밋은 사람이 push한다.
- 머지 순서: 이 MR(V0002) → 로그인 MR !17(V0004) → !17 을 develop 최신으로 맞춰 재검증
- P1·P3 리뷰: 실행 중 상태 표현, 전역 content_hash 중복과 재수집 이력, 미상 코드 유효 기간·겹침·지역 부모 순환 검증 책임.
- 관측값·문서·카드·질문·분석 run·수정 제안·사용자 테이블은 후속 범위. C1 메타 보존과 복합 카드 버전 FK를 먼저 합의한다.
- 운영 seed·API·JPA Entity·배포는 이번 범위 밖이며 push는 사람이 한다.
