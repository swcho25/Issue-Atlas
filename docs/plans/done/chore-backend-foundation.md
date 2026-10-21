# chore/backend-foundation — 백엔드 기초 작업 통합 및 MR

- Jira: S15P31C108-69 · S15P31C108-70 · S15P31C108-72 · PRD: — · 묶음/단위: 공통 하네스·P7 서버 공통

## 완료 조건

- [x] 도메인 내부 계층과 개발 컨벤션, ArchUnit 규칙을 통합한다
- [x] Java 포맷 검사·수정 명령과 pnpm check·Gradle build 연결을 통합한다
- [x] 공통 오류 응답·계약 초안·웹 테스트를 통합한다
- [x] pnpm check:all 전체 검사와 검토를 완료하고 MR 템플릿에 결과·미검증을 기록한다
- [x] 최신 MR 템플릿으로 변경 범위·검증·계약 리뷰 항목을 정리한다

## 진행

- 2026-10-21: 사용자 기초 작업 MR 요청으로 시작. 이번 요청은 MR 생성에 필요한 commit·push를 허용한 것으로 적용. 기존 finish 스킬의 기본 push 금지보다 사용자 지시를 우선한다.
- 2026-10-21: origin/develop 0d3e42f를 fetch한 뒤 chore/backend-foundation을 별도 worktree에 생성. 최신 AGENTS.md·MR 템플릿·Merge commit 규칙을 보존하면서 구조(69)·포맷(70)·오류 응답(72) 세 작업을 통합. C1(68)·DB(73) 및 로컬 원본 샘플은 포함하지 않음.
- 2026-10-21: 원래 작업 트리들은 그대로 보존. 구현이 끝난 세 작업 계획을 done에 인계하고 이 통합 계획에서 전체 검사와 MR을 추적한다.

- 2026-10-21: pnpm check:all 첫 실행은 E2E 포트 3100 충돌(EADDRINUSE)로 실패. 기존 서버는 건드리지 않고 Playwright 설정에 E2E_PORT 선택 기능(기본 3100 유지, 정수·범위 검증)을 추가하여 별도 포트 사용. frontend/src 변경이 없어 test 스킬 기준 새 UI 테스트는 추가하지 않고 기존 테스트를 그대로 실행. Next 번들 Playwright 가이드 확인.
- 2026-10-21: 두 번째 전체 검사는 E2E용 chromium_headless_shell-1248 미설치로 실패. 프로젝트 안내의 pnpm --filter frontend exec playwright install chromium 실행. CDN 일부 DNS 실패 후 설치 도구의 대체 CDN으로 Chromium·FFmpeg·Headless Shell·Winldd 다운로드 완료. 저장소 의존성·lockfile은 변경하지 않음.

- 2026-10-21: E2E_PORT=56931로 pnpm check:all 전체 통과. harness 1.7s, backend format 1.9s, frontend lint 7.9s, frontend typecheck 3.5s, frontend test 4.3s(9 tests), frontend e2e 14.5s(Chromium 1 test + next build), backend build 33.4s(17 tests: ArchUnit 6 + PostGIS 통합 1 + 오류 응답 10). git diff --check 통과.
- 2026-10-21: 최신 MR 템플릿으로 검증 결과·범위·frontend 계약 리뷰 항목을 정리. GitLab 로그인 계정 장성우(sungwoo515)의 프로필을 확인하여 해당 이름·이메일로 커밋. repo/global 사용자 설정을 바꾸지 않고 commit 호출에만 identity 적용. 계획은 done으로 이동하며 MR 링크·커밋은 Jira 코멘트와 채팅에 기록한다.

## 다음 할 일 / 범위 밖

- MR의 frontend 계약 리뷰를 받고 팀 Merge commit 규칙으로 병합한다. 자동 병합·스쿼시는 사용하지 않는다.
- 공통 HTTP 오류 계약의 frontend 리뷰는 MR에서 받아야 한다. CI 설정은 아직 비활성 상태라 로컬 검사 결과와 구분한다.
- C1(68)·DB(73)는 별도 초안으로 유지한다. 운영 배포·DB 적용·MR 병합은 이번 요청 범위 밖이다.
