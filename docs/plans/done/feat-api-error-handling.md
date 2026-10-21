# feat/api-error-handling — API 공통 오류 응답·입력 검증 추가

- Jira: [S15P31C108-72](https://ssafy.atlassian.net/browse/S15P31C108-72) · PRD: — · 묶음/단위: P7 서버 공통

## 완료 조건

- [x] 공통 오류 응답에 HTTP 상태·오류 코드·안내 메시지·경로·필드 오류를 일관되게 반환한다
- [x] 입력 검증 및 JSON/요청 오류는 400, 없는 리소스는 404, 예상하지 못한 오류는 500으로 처리한다
- [x] 서버 오류 메시지·스택·입력 원문을 응답에 노출하지 않고 기존 MVC 상태와 헤더를 보존한다
- [x] 오류 계약 초안과 사용법을 문서화하고 웹 테스트·백엔드 검사·빌드 결과를 계획에 기록한다

## 진행

- 2026-10-21: 사용자 다음 작업 요청으로 시작. origin/develop db18195에서 feat/api-error-handling을 별도 worktree C:/Users/SSAFY/Desktop/S15P31C108-wt-api-errors에 생성. C1·구조·포맷 브랜치의 미커밋 변경 보존.
- 2026-10-21: Jira 중복 확인 후 [P7] 서버 공통 에픽 아래 생성, 담당 장성우·기본 SP 1·활성 스프린트·진행 중. 필드·전이 ID는 조회하여 사용하고 파일에 저장하지 않음.
- 2026-10-21: Spring 공식 문서 확인 후 ResponseEntityExceptionHandler 기반 공통 처리 구현. ProblemDetail + code/errors, @Valid 요청 DTO 오류 정렬, 400/404/500 및 기존 MVC 상태·헤더 보존. ResourceNotFoundException·오류 enum·필드 오류 record 추가. 새 런타임 의존성 없음.
- 2026-10-21: contracts/http-errors/README.md에 오류 계약 v0.1 초안 작성, contracts 인덱스와 backend/AGENTS.md 연결. 테스트용 Controller는 src/test에만 두고 실제 업무 API·성공 응답 형식은 만들지 않음.

- 2026-10-21: 최초 웹 테스트 10개 중 type 필드 확인 1개 실패. Spring/Jackson이 기본 about:blank type을 생략하는 동작을 확인하고 오류 코드별 고정 URI(urn:issue-atlas:error:invalid-request 등)를 명시하여 코드·계약·검증을 일치시킴. 이후 웹 테스트 10개 전부 통과(BUILD SUCCESSFUL, 11s).
- 2026-10-21: pnpm check 종료 0, backend test 26.6s. 총 15개 테스트 통과(기존 구조 4 + PostGIS 통합 1 + 오류 응답 웹 10). 400 검증/JSON/필수 본문/쿼리 타입·누락, 404 리소스·경로, 405 Allow 보존, 500 내부 메시지·쿼리·스택 비노출, 성공 응답 유지 확인.
- 2026-10-21: pnpm backend:build 종료 0, BUILD SUCCESSFUL(3s), bootJar 생성 확인. git diff --check 통과. package.json·pnpm-lock.yaml·backend/build.gradle·frontend 변경 없음. pnpm check 실행 시 기존 의존성 554개를 캐시에서 준비했으며 새 의존성은 추가하지 않음. 커밋·push 없음.

- 2026-10-21: 사용자 MR 요청으로 chore/backend-foundation에 기초 작업을 통합. 원래 작업 트리는 보존. 이 계획의 구현은 통합 MR로 인계하며 최종 검증·커밋·MR 링크는 chore-backend-foundation 계획에 기록한다.

- 2026-10-21: 통합 브랜치에서 pnpm check:all 전체 통과. 구조 6개·오류 웹 10개·PostGIS 통합 1개 및 프론트 테스트·Chromium E2E 검증. 최종 결과는 [통합 계획](chore-backend-foundation.md) 참조.

## 다음 할 일 / 범위 밖

- frontend 담당 리뷰 후 오류 계약을 C2에 통합한다.
- 인증·보안 필터 오류·업무별 오류 코드·성공 응답은 별도 작업이다.
