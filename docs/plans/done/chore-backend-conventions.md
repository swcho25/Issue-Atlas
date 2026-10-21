# chore/backend-conventions — 백엔드 도메인 패키지 구조·개발 컨벤션 확정

- Jira: [S15P31C108-69](https://ssafy.atlassian.net/browse/S15P31C108-69) · PRD: — · 묶음/단위: 공통 개발 환경·하네스

## 완료 조건

- [x] docs/backend-architecture.md에 도메인별 패키지와 내부 controller·service·repository·entity·dto 역할 및 의존 방향을 정의한다
- [x] backend/AGENTS.md에 합의한 구조와 개발 규칙 및 상세 문서 링크를 반영한다
- [x] ArchitectureTest가 service→controller, repository→service/controller의 역방향 의존을 금지한다
- [x] Docker 없이 구조 테스트를 실행하고, 전체 백엔드 검사 결과 또는 환경 제약을 계획 파일에 기록한다

## 진행

- 2026-10-21: 사용자가 도메인별 패키지와 내부 계층 구조에 동의하여 시작. C1 미커밋 변경 보존을 위해 별도 worktree C:/Users/SSAFY/Desktop/S15P31C108-wt-backend-conventions에 chore/backend-conventions 생성. 기준 origin/develop db18195. 원래 C1 작업 트리는 변경하지 않음.
- 2026-10-21: Jira 중복 확인 후 [공통] 개발 환경·하네스 에픽 아래 이슈 생성. 담당 장성우, 기본 SP 1, 활성 스프린트, 진행 중. 필드·전이 메타데이터는 매번 조회하고 ID를 파일에 저장하지 않음.
- 2026-10-21: 기능별 패키지·계층 역할·common 경계·생성자 주입·record DTO·Service 트랜잭션·Entity 직접 응답 금지를 문서와 backend/AGENTS.md에 반영. 예시 place/evidence의 빈 디렉터리나 업무 구현은 만들지 않음. ArchUnit 역방향 의존 검사 2개 추가.
- 2026-10-21: docker info 실패: dockerDesktopLinuxEngine named pipe 없음. Docker를 요구하는 전체 DB 통합 테스트·전체 빌드는 실행 불가. 구조 테스트는 Docker 없이 별도 실행하여 통과(아래 결과).

- 2026-10-21: `node scripts/gradle.mjs test --tests com.c108.issueatlas.ArchitectureTest` 최초 통과(6 tests, failures=0). 임시 architectureprobe 소스에 service→controller 및 repository→service/controller 의존을 넣자 신규 규칙 2개가 정확히 실패(6 tests, 2 failed, 예상 종료 1). 임시 소스 제거 후 같은 명령으로 6개 재통과(BUILD SUCCESSFUL, 8s). 임시 파일은 남기지 않음.
- 2026-10-21: `node scripts/check.mjs`는 backend 영역을 감지했으나 Docker 중단으로 종료 1. 출력: `Docker 가 꺼져 있습니다. backend 테스트(Testcontainers)는 Docker 가 필요합니다. Docker Desktop 을 켠 뒤 같은 명령을 다시 실행하세요`. 전체 통합 테스트·build 통과로 보고하지 않음. git diff --check 통과. 커밋·push 없음.

- 2026-10-21: 사용자 MR 요청으로 chore/backend-foundation에 기초 작업을 통합. 원래 작업 트리는 보존. 이 계획의 구현은 통합 MR로 인계하며 최종 검증·커밋·MR 링크는 chore-backend-foundation 계획에 기록한다.

- 2026-10-21: 통합 브랜치에서 pnpm check:all 전체 통과. 구조 6개·오류 웹 10개·PostGIS 통합 1개 및 프론트 테스트·Chromium E2E 검증. 최종 결과는 [통합 계획](chore-backend-foundation.md) 참조.

## 다음 할 일 / 범위 밖

- C2 성공 응답·실제 업무 API·핵심 Flyway 테이블은 별도 작업. 통합 MR 추적은 chore-backend-foundation 계획 참조.
