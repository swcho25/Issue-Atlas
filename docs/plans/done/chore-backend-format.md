# chore/backend-format — Java 포맷 검사·자동 수정 및 하네스 연결

- Jira: [S15P31C108-70](https://ssafy.atlassian.net/browse/S15P31C108-70) · PRD: — · 묶음/단위: 공통 개발 환경·하네스

## 완료 조건

- [x] 버전이 고정된 Java 포맷 도구를 적용하고 기존 Java 파일을 같은 규칙으로 정리한다
- [x] pnpm backend:format:check는 검사만, pnpm backend:format은 자동 수정을 수행한다
- [x] pnpm check 및 check:all에서 백엔드 포맷을 검사하고 Gradle build에도 검사가 연결된다
- [x] 포맷 위반 시 실패와 자동 수정 뒤 통과를 확인하고 검증 결과를 계획에 기록한다

## 진행

- 2026-10-21: 사용자 다음 작업 요청으로 시작. 기존 C1·도메인 구조 작업은 각각 미커밋 상태로 보존하고 새 worktree C:/Users/SSAFY/Desktop/S15P31C108-wt-backend-format, 브랜치 chore/backend-format 생성(origin/develop db18195 기준). 별도 포맷 이슈 중복 없음 확인, 담당 장성우·기본 SP 1·활성 스프린트·공통 에픽으로 생성 후 진행 중 전이. 필드·전이 ID는 조회하여 사용하고 저장하지 않음.
- 2026-10-21: 공식 Spotless Gradle 문서·플러그인 포털 확인. Spotless 8.10.4와 google-java-format 1.24.0 AOSP(공백 4칸) 고정. 사용하지 않는 import·줄 끝 공백·파일 끝 개행 정리. Java 21에서 실행.
- 2026-10-21: 포맷 검사·자동 수정 pnpm 명령 추가. pnpm check에서 backend format을 Docker 테스트와 프론트 검사보다 앞에 배치하고 check:all에도 포함. Gradle check/build는 Spotless 기본 연결 사용. 기존 GitLab backend build 잡은 그대로 두고 CI 활성화는 인프라 담당 작업으로 유지.
- 2026-10-21: 최초 spotlessCheck는 Java 원본 5개에서 형식 위반으로 종료 1. src/main BackendApplication 및 src/test ArchitectureTest·BackendApplicationTests·TestBackendApplication·TestcontainersConfiguration. pnpm backend:format은 종료 0, BUILD SUCCESSFUL(1s). 기존 Java 소스 5개를 포맷만 변경.
- 2026-10-21: pnpm install --frozen-lockfile로 새 worktree의 기존 의존성 준비(캐시 554개 재사용). Node 의존성·pnpm-lock.yaml 추가 변경 없음. docs/backend-format.md와 backend/AGENTS.md·루트 명령표 갱신.

- 2026-10-21: pnpm backend:format:check 종료 0. 자동 수정 이후 BUILD SUCCESSFUL. 구조 테스트는 기존 develop의 4개 통과. build --dry-run에서 spotlessJavaCheck·spotlessCheck가 check/build에 포함됨 확인.
- 2026-10-21: pnpm check 종료 0. Docker에 접근 가능하여 DB 통합 테스트까지 통과. harness 1.5s, backend format 2.5s, frontend lint 81.0s, frontend typecheck 28.1s, frontend test 35.6s(3개 파일·9개 테스트), backend test 56.5s(ArchUnit 4개 + Spring/PostGIS 통합 1개).
- 2026-10-21: pnpm backend:build 종료 0, BUILD SUCCESSFUL(5s). spotlessCheck 포함 및 bootJar 생성 확인. check:all 전체 E2E는 MR 직전에 실행하며 이번에 실행했다고 보고하지 않음. git diff --check 통과. frontend/와 pnpm-lock.yaml 변경 없음. 커밋·push·CI 활성화 없음.

- 2026-10-21: 사용자 MR 요청으로 chore/backend-foundation에 기초 작업을 통합. 원래 작업 트리는 보존. 이 계획의 구현은 통합 MR로 인계하며 최종 검증·커밋·MR 링크는 chore-backend-foundation 계획에 기록한다.

- 2026-10-21: 통합 브랜치에서 pnpm check:all 전체 통과. 구조 6개·오류 웹 10개·PostGIS 통합 1개 및 프론트 테스트·Chromium E2E 검증. 최종 결과는 [통합 계획](chore-backend-foundation.md) 참조.

## 다음 할 일 / 범위 밖

- GitLab Runner·CI 활성화는 인프라 담당 작업으로 남긴다. 통합 MR에서 Java 포맷과 E2E 포트 분리를 함께 검증한다.
