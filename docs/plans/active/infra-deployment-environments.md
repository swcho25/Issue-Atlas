# infra/deployment-environments — 운영·개발 배포 환경 분리

- Jira: S15P31C108-137

## 완료 조건
- [ ] main/develop이 운영/개발 Worker·API·DB·수집기 설정으로 각각 연결된다.
- [ ] 기존 개발 DB 볼륨·배포 기록을 보존하며 운영 배포·복구 기록을 분리한다.
- [x] 변경 영역 선택과 환경별 배포·복구 검사가 통과한다.
- [ ] 서버·Cloudflare·GitLab 전환 절차와 실제 검증 여부를 기존 README에 반영한다.

## 진행
- 2026-10-29: 기존 EC2 4 CPU·15GiB 메모리, V0010, 수집 데이터 0건 확인. 기존 환경은 개발용 유지. 운영 환경은 새 DB로 시작하며 수집은 자동 실행하지 않는다.
- 2026-10-29: 최초 운영 배포는 develop 전체를 main에 MR한 뒤 FE·BE·수집기를 모두 배포하고 운영 화면에서 연동 검증한다. CI 중복 최적화는 범위 밖.
- 2026-10-29: 배포·환경 선택 테스트 34건 및 pnpm check(FE lint/typecheck/단위 9건) 통과. Workers Next 빌드는 통과했지만 Windows 번들 심볼릭 링크 EPERM으로 최종 Workers 빌드 미완료. 시스템 설정 변경 없이 Linux 검증용 소스만 서버 임시 경로에 전달했고 컨테이너 검증은 아직 실행하지 않았다.
- 2026-10-29: 개발 DB 백업 `/var/backups/issueatlas/environments-137/development-before-split.dump` 생성 및 pg_restore 목록 확인(복원 테스트 아님). 개발 health 유지. 운영 PostGIS만 새 `issueatlas-prod_postgres-data` 볼륨·5433 포트로 준비, 업무 테이블/운영 Spring/수집기 실행 없음. 비밀번호는 서버에서 별도 생성하여 보호된 파일에만 저장했다.
- 2026-10-29: Cloudflare `dev-backend.issue-atlas.kr`을 기존 개발 backend로 추가 연결, HTTPS health UP 확인. 기존 backend/root 도메인 연결은 아직 유지한다. 운영 Tunnel origin 전환·개발 Worker 생성·서버 배포 프로그램 교체는 아직 하지 않았다.
- 2026-10-29: 사용자 제보 GitLab 장애로 변수 범위 전환·MR/자동 배포 검증은 중단. 전체 pnpm check:all 및 Linux Workers 양 환경 검증도 완료로 표시하지 않는다.
- 2026-10-29 재개: origin/develop 0959007을 fast-forward 반영하고 보관했던 환경 분리 변경을 복원했다. 최신 press 실행 명령을 유지했다. 배포 테스트 34건, FE lint/typecheck/단위 9건/Node E2E 2건 및 engine lint·340건 테스트 통과. pnpm check:all은 로컬 Docker 미실행으로 backend build 단계에서 중단됐으므로 전체 통과 아님.
- 2026-10-29 재개: 비밀 없는 EC2 CI Docker 임시 컨테이너에서 development/production 각각 Workers 빌드·dry-run·Workers E2E 2건씩 통과. 각 환경의 API 주소와 Worker self binding이 일치함을 확인했다. 임시 컨테이너·서버 소스 사본은 정리했고 `/var/log/issueatlas/verification-137/workers.log`를 보관했다.
- 2026-10-29 재개: 서버의 기존 배포 프로그램·설정은 별도 config 백업 후 환경 분리 버전으로 설치했다. 개발 backend는 기존 실행 이미지 그대로 네트워크 alias를 추가했고 Tunnel은 두 네트워크에 연결했다. dev-backend origin은 `http://issueatlas-development-backend:8080`으로 고정, HTTPS UP 확인. 개발 DB·기존 배포 기록·비밀은 유지했다. 운영 Spring은 미기동이다.
- 2026-10-29 재개: GitLab 4개 접속 변수는 Protected·shared-ec2 상태 그대로이며 *-ec2 범위 변경은 사용자 확인 대기. CI 환경명은 development-ec2/production-ec2 및 development-workers/production-workers다.
- 2026-10-29: 사용자 승인 후 DEPLOY_HOST·DEPLOY_USER·SSH_KNOWN_HOSTS·SSH_PRIVATE_KEY의 GitLab 환경 범위를 `*-ec2`로 변경했다. 새로 고침 후 4개 모두 저장 확인. Protected 유지, 두 SSH 변수의 File 형식 유지. 변수 값은 조회·교체하지 않았다.
- 2026-10-29 최종 검사: Docker 접근 가능한 로컬에서 `pnpm check:all` 전체 통과(harness·BE format/build/통합 테스트·FE lint/typecheck/단위 9건/E2E 2건·engine lint/340건). 배포 테스트 34건 및 `git diff --check`도 통과. 약 98초. 커밋·푸시·MR은 수행하지 않았다.

## 다음 할 일 / 범위 밖
- MR !45/!49/!51/!52의 Flyway 순서 유지. 다른 팀원 수집기 명령 변경은 별도 MR에서 반영한다.
- 저장소 수정·로컬 검사 후 서버 준비, 도메인 연결, GitLab 변수 범위 전환, 실제 병합 배포 검증.
- 전체 검사와 GitLab 접속 변수 범위 전환은 완료됐다. 사람이 commit/push/MR한다.
- develop 병합 후 개발 Worker 첫 배포 확인. 기존 backend.issue-atlas.kr origin은 현재 개발 backend이므로 운영 첫 main 배포 직전에 issueatlas-production-backend:8080으로 바꿔야 한다. 미기동 운영 origin으로 전환한 동안 운영 주소는 아직 응답하지 않을 수 있다. 개발 주소는 유지한다.
- main 최초 전체 배포·운영 화면/API/로그인 및 환경 간 데이터 격리 실검증은 아직 미완료다. 운영 수집기 API 키는 미설정이며 실제 수집은 실행하지 않는다.
