# infra/backend-cicd — 백엔드 CI 및 develop·main 자동 배포

- Jira: S15P31C108-103 · 묶음/단위: 인프라 공통
- 기준: origin/develop c122c78. 팀 합의: develop·main 대상 MR은 CI만, 두 브랜치 병합 후 CI 성공 시 같은 EC2 Spring에 자동 배포한다.

## 완료 조건

- [ ] develop·main 대상 MR 생성·갱신 시 CI가 실행되고 배포 자격 증명과 배포 작업은 제공되지 않는다.
- [ ] 두 브랜치 병합 후 검사 성공 시 커밋 SHA/digest로 식별한 이미지가 저장·배포된다.
- [ ] 같은 EC2에 대한 배포를 직렬화하고 뒤늦은 이전 파이프라인의 덮어쓰기를 방지한다.
- [ ] PostGIS·Tunnel을 유지하며 HTTPS health와 배포 버전을 확인하고 실패 복구를 검증한다.
- [ ] 비밀정보를 저장소에 넣지 않고 Runner·Registry·서버 설정과 검증 결과를 문서화한다.

## 진행

- 2026-10-26: MR !28 첫 파이프라인 #241514의 frontend가 pnpm install 중 루트 prepare의 git config에서 실패(exit 127). Node slim 이미지에 git이 없어 발생한 CI 실행 환경 누락이다. frontend before_script에 git·ca-certificates 설치를 추가했다. 동일한 고정 Node 이미지·임시 Git 저장소에서 frozen-lockfile 설치와 prepare, frontend lint·typecheck·단위 테스트 9건 PASS. E2E와 실제 새 MR 파이프라인은 미검증. 기존 파이프라인 재시도만으로는 반영되지 않으며 수정 커밋 push 후 새 MR 파이프라인에서 확인한다.

- 2026-10-26: 사용자 승인으로 배포 전용 Ed25519 키 생성·forced-command 등록 및 GitLab 배포 변수 4개 등록 완료(File 2개, Protected/shared-ec2). root 소유 배포 프로그램·설정·release overlay 설치, Compose 파일과 부모 경로 권한 보호. 실행 위치에 의존하지 않도록 명시적 --env-file 사용. 직접/CI 컨테이너 SSH 인증 및 임의 명령 차단, 설치본 Compose 합성·현재 이미지 조회·내외부 health 점검 PASS. 배포 단위 테스트 13건·lint/format·diff 검사 PASS. 서비스 이미지는 교체하지 않았으며 실제 Registry 업로드/pull·MR·CD 검증은 사용자 push 후 진행한다.

- 2026-10-26: Docker Hub 변수 3개 등록 확인 후 Protected 적용, 토큰 Masked 유지, MR protected resources 접근 해제. 사용자 승인으로 프로젝트 Runner #2252 생성·EC2 등록 완료. 공식 Runner 19.5.1, 태그 issueatlas-docker, 프로젝트 잠금, 동시 실행 1. CI 전용 daemon/socket/저장소와 CPU 2개분·메모리 8GB 공통 slice 적용. 일반 작업 privileged=false, 지정한 dind 서비스만 privileged 허용. gitlab-runner verify 성공과 GitLab Online/Idle 확인. 기존 PostGIS·Spring·Tunnel healthy 및 HTTPS health UP 유지. 실제 MR/CD와 서버 재부팅 검증은 별도다.

- 2026-10-26: 사용자가 이슈 103과 브랜치 생성·구현 승인. origin fetch 후 infra/backend-cicd 생성. 기존 pnpm-lock 도구 메타데이터 변경은 이름 있는 stash로 보존했다.
- Jira 연결 도구는 현재 세션에 없어 번호를 계획에 기록했다. GitLab 계정 접근을 통해 Runner·Registry 설정 확인 중.
- 2026-10-26: GitLab 프로젝트 읽기 가능. 현재 계정의 사이드바에 Settings가 없고 CI/CD settings 주소는 404여서 Runner·변수·보호 브랜치를 확인/수정하지 못했다. 사용자에게 Maintainer 설정 방법 확인 요청. 터미널 중심으로 작업하라는 요청에 따라 이후 UI 작업 중단.
- 2026-10-26: 루트 CI와 검사·이미지·배포 job 구현. 보호된 develop/main push만 CD, MR에서는 CI만 실행. SHA 태그 업로드 후 digest 배포, 같은 resource group·환경 및 서버 공통 pipeline watermark 사용.
- 2026-10-26: 제한된 SSH 명령용 배포 프로그램과 전송 클라이언트 구현. 작업 전용 Registry 인증을 임시로 사용하고, 이미지 출처·revision 검증 후 backend만 교체한다. 상태 확인 실패 시 기존 image ID 복구를 시도하며 job은 실패 처리한다.
- 2026-10-26: 새 배포 코드 lint/format, 실패 복구·권한 경계 테스트 13건 PASS. YAML 구문·script 문자열 형식, 더미 값으로 세 Compose 파일 합성 검사 PASS. pnpm check:all 전체 PASS(프론트 단위 9/E2E 1, backend build는 기존 UP-TO-DATE 결과 포함, engine 213 tests).
- 기존 EC2의 PostGIS·Spring·Tunnel 상태는 정상이다. Runner·배포 키·서버 배포 프로그램 설치 및 SSH 점검은 완료했다. 실제 GitLab 파이프라인·Registry·이미지 교체·자동 복구 통합 검증은 남아 있다.

## 다음 할 일 / 범위 밖

- 2026-10-26 최신 결정: 사용자 Maintainer 승격 후 직접 UI 확인. 제공된 Runner·Registry 없음. 사용 가능한 서버는 기존 EC2 한 대. Docker Hub Private 저장소 `swcho25/issueatlas-backend` 생성 완료(사용자 확인). 코드·예제 설정을 Docker Hub로 변경하고 업로드/읽기 토큰을 분리했다. 변경 후 배포 테스트 13건과 lint 통과. 이후 자체 Runner·자원 제한·전용 Docker daemon·GitLab 토큰 변수·SSH 배포 설정을 완료했다. Docker-in-Docker 내부의 컨테이너 실행·GitLab HTTPS 통신 스모크도 통과했고 임시 컨테이너·전달용 인증 파일은 정리했다. 실제 GitLab job은 아직 0건이며 파이프라인 검증이 남아 있다.

- 프론트 Workers·수집기·RabbitMQ 배포는 제외한다. main/develop은 동일 서비스를 교체하며 마지막 성공 배포가 실행된다.
- DB 마이그레이션은 이미지 롤백으로 취소되지 않는다. 호환되지 않는 변경의 DB 복구는 별도 절차다.
- git push·MR 병합은 사용자 수행. 실제 GitLab 파이프라인 검증은 브랜치 push 후 가능하다.
