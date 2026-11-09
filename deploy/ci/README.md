# 백엔드 CI/CD — S15P31C108-103

> 현재 290번 구성: 백엔드 전용 주소는 [Nginx·HTTPS 직접 연결](../backend/README.md). 두 환경의 Compose는 `compose.yaml` + `compose.https.yaml` + `compose.release.yaml`이며 Tunnel은 사용하지 않는다. 아래 137번 최초 전환의 Tunnel 설명은 과거 설치 기록이다. 공개 API·health 주소와 환경 분리는 유지한다.

수집기 이미지 자동 갱신·수동 실행은 [수집기 배포](../collector/README.md)를 참고한다.

## 실행 조건

| 이벤트 | 동작 |
| --- | --- |
| develop/main 대상 MR 생성·갱신 | 변경 영역 검사, FE 변경 시 standalone 빌드·E2E 포함. 배포 없음 |
| 보호된 develop/main에 병합(push 파이프라인) | 변경 영역 검사 → 해당 이미지 빌드 → 해당 서비스만 자동 배포 |
| New pipeline에서 보호된 develop/main 및 REDEPLOY_COMPONENT=frontend 선택 | FE 검사·standalone 빌드 → FE 이미지 → EC2 FE만 배포 |
| 다른 브랜치 push·태그·스케줄·그 밖의 웹 수동 파이프라인 | 실행 안 함 |

137번부터 `develop → development`, `main → production`으로 분리한다. 같은 EC2를 사용하되 개발은 `/opt/issueatlas-dev`(기존 볼륨 유지), 운영은 `/opt/issueatlas-prod`(새 볼륨)를 사용한다. 환경별 잠금·pipeline 상한·복구 기록을 분리하고, 같은 환경의 BE·수집기·engine·FE는 직렬 배포한다. 직접 push는 계속 금지하며 MR로만 병합한다.

## 환경 분리 전환 — S15P31C108-137

| 항목 | development / develop | production / main |
| --- | --- | --- |
| 프론트 | dev.issue-atlas.kr / issueatlas-frontend-dev | issue-atlas.kr / issueatlas-frontend |
| API | dev-backend.issue-atlas.kr | backend.issue-atlas.kr |
| 서버 경로 | /opt/issueatlas-dev | /opt/issueatlas-prod |
| 로컬 Spring / DB 포트 | 8080 / 5432 | 8081 / 5433 |
| Compose / 볼륨 | issueatlas-dev / issueatlas-dev_postgres-data | issueatlas-prod / issueatlas-prod_postgres-data |

환경 설정의 원본은 `cicd.example.json`이다. SSH 요청의 branch로 서버가 설정을 선택하며 CI가 임의 경로를 지정하지 못한다. 기존 `.deploy`는 개발 기록으로 보존하고 운영 기록은 새 경로에 생성한다. 운영 첫 배포 실패 시 후보 컨테이너를 정지하며 이전 버전이 없는 것을 복구 성공으로 표시하지 않는다. DB 마이그레이션은 되돌리지 않는다.

전환 순서:
1. 실행 중인 파이프라인이 없는지 확인하고 기존 DB를 `pg_dump -Fc`로 백업한다. 볼륨 삭제나 개발 DB 복제는 하지 않는다.
2. `/opt/issueatlas-prod/deploy/dev`에 `compose.yaml`, `compose.release.yaml`을 root 소유로 설치한다. 별도 `.env`는 root 600으로 만들며 운영 DB·관리자 비밀번호는 새로 생성한다. `COMPOSE_PROJECT_NAME=issueatlas-prod`, `DB_HOST_PORT=5433`, `BACKEND_HOST_PORT=8081`, `BACKEND_NETWORK_ALIAS=issueatlas-production-backend`, `SESSION_COOKIE_SECURE=true`로 설정한다. 운영 postgres만 먼저 실행해 네트워크와 빈 DB를 준비한다.
3. 개발 경로의 최신 Compose와 `compose.routing.yaml`을 설치한다. Tunnel은 개발 경로에서 한 개만 운영하며 두 네트워크에 연결한다. 개발 API origin은 `http://issueatlas-development-backend:8080`, 운영은 `http://issueatlas-production-backend:8080`이다. DNS의 API hostname은 기존 Tunnel로 연결한다. 운영 API의 기존 origin 전환은 운영 backend 기동 시점에 맞춘다. 기존 운영 프론트 주소를 개발 DB에 계속 연결한 채 완료로 표시하지 않는다.
4. 운영 수집기의 설정·input/output/log 경로는 example JSON대로 별도로 준비한다. API 키는 준비된 경우에만 서버 관리자가 설정한다. 수집기 실행이나 데이터 이관은 자동으로 하지 않는다.
5. 검토한 배포 프로그램·수동 실행기·example JSON을 기존 설치 경로에 설치하고, egress 복원 스크립트를 갱신한다. 개발 DB·배포 기록·개인키·Tunnel 토큰은 교체하지 않는다.
6. GitLab의 `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `DOCKERHUB_PULL_TOKEN`은 기존 `shared-ec2` 범위를 `*-ec2`로 바꾼다. development-ec2/production-ec2와 전환 중 shared-ec2에서 같은 EC2 인증을 사용하며 빌드·검사 job에는 전달하지 않는다. 값은 로그/저장소에 출력하지 않는다. Cloudflare 변수·Docker push 변수는 기존 protected `*` 범위를 유지한다. 각 환경의 배포 변수는 MR에 제공하지 않는다.
7. develop MR로 개발 배포를 확인한다. 이어 develop 전체를 main에 MR하여 운영 FE·BE·수집기를 모두 최초 배포한다. Flyway MR 순서 V0011→V0012→V0013→V0014를 유지한다. 화면·API·인증·서로 다른 DB 연결 및 수집기 배포 기록을 확인한다.

설정 파일의 서버 설치는 자동 CD 범위가 아니다. 첫 병합 전에 서버 준비와 GitLab 변수 전환을 마쳐야 한다. 기존 환경으로 되돌릴 때는 백업한 프로그램·설정·Compose·변수 범위·Tunnel origin을 함께 복구하며 볼륨은 보존한다. 257번 FE는 이전 FE 이미지가 있으면 자동 복구한다. DNS·Custom Domain 전환의 복구는 별도 수동 절차다.

### 변경 영역 선택 (S15P31C108-113)

경로 목록은 `.gitlab/ci/changes.gitlab-ci.yml`에서 관리한다. 151번부터 계약 검사와 실행 산출물의 빌드·배포 조건을 분리한다. MR은 대상 브랜치와의 차이, 병합 후 push는 해당 브랜치의 이전 커밋과의 차이를 사용한다. 명시적 FE 수동 실행은 별도 조건을 사용하며 BE/engine의 web 실행을 차단한다. 스케줄은 workflow에서 허용하지 않는다.

| 변경 | 추가로 실행할 작업 (harness·infra는 항상 실행) |
| --- | --- |
| FE 소스·설정·E2E, pnpm 잠금/설정, FE 점검 스크립트 | FE 검사·standalone 빌드, 병합 후 FE 이미지·EC2 배포 |
| BE 소스·Flyway·Gradle·Dockerfile, 개발 Compose | BE 검사·이미지, 병합 후 BE 배포 |
| engine/pipeline·ai·의존성·Dockerfile, 수집기 실행 설정 | engine 검사·수집기 이미지, 병합 후 수집기 버전 갱신 (수집 자동 실행 없음) |
| engine/api, contracts/ai·c2 schemas | engine 검사. develop 병합 후 engine(문장화 API) 이미지·배포 |
| engine/tests·tests_postgres, ai의 MD 설명 | engine 검사만 |
| contracts의 JSON/YAML | FE·BE·engine 검사. C1 JSON은 수집기 실행 및 이미지 smoke test에서 읽으므로 수집기 이미지·배포도 실행. FE·BE 이미지·배포는 생략 |
| 공통 CI YAML | FE·BE·engine 모두 검사하고 병합 후 모두 배포 |
| deploy/ci의 공통 Python·JSON | BE·수집기 검사·이미지·배포 (FE 로직 변경은 FE 경로도 함께 변경) |
| docs, 루트/서비스/계약 README, pipeline의 MD 설명 | 가벼운 harness·infra 검사만 |

engine(문장화 API) 이미지는 engine/pipeline·ai·의존성·Dockerfile·개발 Compose·공통 CI·deploy/ci 변경에도 다시 만든다. 단 **develop 에서만** 만들고 배포한다(243번, 운영은 별도 MR). 서버 준비 순서는 [개발 서버 engine](../dev/README.md#논증-문장화-engine-s15p31c108-243).

여러 영역을 바꾸면 합집합으로 실행한다. scripts 변경은 FE 검사·빌드에도 반영한다. pipeline·ai 실행 입력은 py/json/yaml/yml/toml/sql/txt/csv를 대상으로 하며 MD 설명은 제외한다. 수집기 이미지가 `engine/ai`를 싣고 embed·score 명령이 이를 실행하므로 ai도 수집기 경로에 포함한다(233번). 새 소스 디렉터리·설정 형식을 도입하면 경로 목록과 선택 시나리오 테스트도 함께 갱신한다.

FE·수집기 배포의 `backend-deploy` 의존성은 optional이다. BE 작업이 없으면 기존 BE/DB를 사용하고, 있으면 성공을 기다린다. 이미지 작업은 check 단계를 모두 통과해야 실행하며, 배포 이미지 artifact 의존성은 필수다. 공통 계약이나 Flyway를 함께 바꿀 때의 호환성 검토는 계속 필요하다.

실패한 배포는 해당 파이프라인의 실패 job을 재시도한다. 이후 무관한 변경을 병합해도 누락된 서비스를 자동 재배포하지 않는다. 서비스마다 마지막 배포 SHA가 달라지는 것은 정상이며, FE는 `/healthz`, BE·수집기는 각 배포 기록으로 확인한다. 변경 없는 서비스를 포함한 강제 전체 배포 기능은 제공하지 않는다.

### 누락된 FE 배포 복구 (151번 후속)

오래된 BE 배포가 차단되어 같은 파이프라인의 frontend-deploy가 skipped된 경우, 이전 BE job을 반복 실행하지 않는다. 아래 수동 실행으로 현재 브랜치의 FE를 새로 검사·빌드·배포한다.

1. 보완 코드가 들어간 브랜치에서 GitLab **Build → Pipelines → New pipeline**을 연다.
2. **Branch**는 `develop`(개발) 또는 `main`(운영)을 선택한다. 해당 브랜치 병합/실행 권한이 필요하다.
3. 표시된 **REDEPLOY_COMPONENT**를 `frontend`로 선택하고 실행한다. SSH 키·Cloudflare 토큰이나 WORKER_ENV/FRONTEND_URL을 직접 입력하지 않는다. 기존 보호 변수와 브랜치별 환경을 사용한다.
4. harness·infra·frontend 검사 → frontend-image 포장·게시 → frontend-deploy 및 HTTPS 검증 성공을 확인한다. BE·수집기 job은 생성하지 않으므로 기존 정상 BE에 연결한다.
5. 대상 환경의 `/healthz` revision이 이번 파이프라인 커밋과 같은지 확인한다. 실행을 기다리는 동안 브랜치가 갱신되면 배포 직전 최신 SHA 확인에서 차단하므로 최신 브랜치로 New pipeline을 다시 생성한다.

기존 push/MR 실행과 같은 환경별 resource group·배포 후 검증을 유지한다. 이전 파이프라인 artifact를 가져오거나 검사 없이 배포하지 않는다. 새 보완 코드는 main에도 병합되어야 main 수동 실행을 사용할 수 있다. 자동 배포 파이프라인에서 BE도 함께 변경된 경우에는 기존처럼 BE 배포 성공을 기다린다.

257번부터 FE 검사는 공식 Playwright 이미지에서 standalone 빌드와 Node E2E를 수행한다. 같은 파이프라인의 artifact를 `frontend-image`가 포장하며 배포 job은 빌드·pnpm 설치를 반복하지 않는다. Node 이미지·Playwright 이미지는 digest로 고정한다. MR artifact를 병합 후 배포에 재사용하지 않는다. pnpm store·Next 컴파일 캐시는 잠금 파일과 환경 기준으로 유지한다.

FE도 기존 protected SSH·Docker Hub 변수와 development-ec2/production-ec2 환경을 사용한다. Workers 토큰은 복구용 구성을 유지하는 동안 남겨두되 새 CI는 사용하지 않는다. 서버 설치·도메인 전환 순서와 첫 배포 상태는 [프론트 EC2 배포](../frontend/README.md)를 따른다. 초기 137번 절차의 Workers 관련 설명보다 이 전환 절차를 우선한다. Runner 동시 실행 수·로컬 pre-push 규칙은 변경하지 않는다.

## 운영 배포 리허설 체크리스트 — S15P31C108-178

develop → main 반영(운영 배포)을 할 때 위에서 아래로 확인한다. main 병합 · 서버 작업은 사람이 한다.

**2026-11-09 기준 상태** (11/5 판에서 고침)

| 항목 | 운영(main) | 개발(develop) |
| --- | --- | --- |
| 코드 | `8281550`(10/30) | 503 커밋 앞섬 |
| Flyway | V0014 | V0051 — 이번 반영은 **migration 36개(V0015–V0051)를 운영 DB 에 한 번에**. V0049 는 없다(번호만 비었고 정상) |
| API 주소 | `backend.issue-atlas.kr` — Nginx 직접 연결(-290, Tunnel 없음) | `dev-backend.issue-atlas.kr` 같음 |
| 화면 주소 | `issue-atlas.kr` — **아직 Cloudflare Workers**. EC2 운영 FE 는 한 번도 배포되지 않았다(검증 주소 `ec2-prod.issue-atlas.kr` 는 Nginx 만 있고 502) | `dev.issue-atlas.kr` — EC2 |
| engine(문장화) | 배포하지 않는다(-243) | 배포됨 |

**전날 · 시작 전**
- [ ] develop · main 파이프라인이 모두 끝났고 develop 최신 커밋의 개발 배포가 성공했다(같은 환경 직렬 배포)
- [ ] 운영 DB 를 수동 백업했다 — 자동 백업(`deploy/backup`)은 개발 DB 만 한다. `pg_dump -Fc` 결과를 `/var/backups/issueatlas` 아래 운영 전용 경로에 두고 `pg_restore --list` 로 읽히는지 본다
- [ ] 새 migration 중 데이터를 지우거나 옮기는 것을 다시 읽었다: V0024 · V0032(ID 바꾸기), V0043 · V0044(보도자료 표 정리), V0042(경계 시드, 크다), V0048 · V0051(저장된 근거 · 실행 결과 UPDATE — 운영은 행이 거의 없다), V0050(`question.asked_by` 칸 · FK 추가). 이전 이미지로 롤백해도 DB 는 돌아가지 않는다
- [ ] 운영 서버의 Compose 파일이 develop 판이다 — CD 는 서버 Compose 를 바꾸지 않는다. `/opt/issueatlas-prod/deploy/dev/` 의 `compose.yaml`(모니터링 · `ENGINE_URL` · engine 서비스 정의) · `compose.https.yaml`(-290) · `compose.release.yaml`(`ENGINE_IMAGE` 칸)을 저장소 판과 비교한다. engine 을 배포하지 않는 환경은 배포 프로그램이 `ENGINE_IMAGE` 에 자리 값(`issueatlas-engine:not-deployed`)을 넣으므로, 서버 배포 프로그램(`/usr/local/sbin/issueatlas-deploy.py`, 개발과 같은 파일)이 그 판인지도 본다
- [ ] `/etc/issueatlas/cicd.json` 의 production 에 `engine_image_repository` 가 **없다**(engine 미배포)와 FE 항목(`frontend_image_repository` 등, `frontend_url` 은 전환 전이라 `https://ec2-prod.issue-atlas.kr`)이 있다
- [ ] 운영 `.env` 변수를 정했다: `QUESTIONS_PER_MINUTE`(기본 10), `ENGINE_URL` 은 **비운다**(비우면 카드 문구로 응답, 사유 `ENGINE_DISABLED`). 나머지 새 변수(`ENGINE_TIMEOUT` · `ENGINE_CACHE_*` · `MONITORING_*`)는 기본값으로 둔다
- [ ] Flyway 밖 시드 `backend/db/seed/cards-c1-a3.sql`(카드 C1 · A3 승인본)을 운영 DB 에 넣을지 정했다. 넣지 않으면 운영 질문은 카드 없음(`unsupported`)이다. 넣으면 반영 **뒤에** 운영 관리자 이메일로 `SET issue_atlas.approver` 를 하고 돌린다(새 DB 라 첫 승인본 v2 가 결과별 판단 문장까지 포함해 들어간다, -282). 그 뒤에 카드 계약이 바뀌는 MR(예 !196 · !197 `sign_words`)이 운영에 들어가면 시드를 다시 돌려 다음 판으로 승인한다
- [ ] 운영 DB 에는 수집 자료가 없다(수집기 자동 실행 없음, -137). 통계 · 측정소 · 기사 없이 무엇을 보여 줄지(빈 상태 · 개발 주소로 데모) 정했다
- [ ] 운영 화면에도 「로그인해야 결과 보기」(-268)가 적용된다. 데모에 쓸 운영 관리자 · 조회자 계정을 정했다(운영 계정은 개발과 따로다. 비밀번호는 저장소 · Jira 에 적지 않는다)
- [ ] 운영 주소에서 Swagger(`/swagger-ui/index.html`)를 계속 열어 둘지 정했다 — 지금은 열려 있고 관리자 API 설명까지 보인다(호출은 로그인 · 관리자 권한으로 막힘)

**반영**
- [ ] MR `chore: develop → main 반영 (YYYY-MM-DD)` 을 만들고 변경 영역 검사가 통과한다
- [ ] 병합 뒤 push 파이프라인에서 backend 배포 → frontend · 수집기 배포 순서로 성공한다(engine job 은 main 에서 만들지 않는다). backend 가 바뀐 develop 파이프라인이 12–15분 걸렸으니(11/6) 그 이상을 잡고, 걸린 시간을 적는다
- [ ] 운영 FE 는 이번이 **EC2 첫 배포**다. 실패하면 후보만 멈추고 「이전 버전으로 복구」로 표시되지 않는다(이전 FE 가 없음, [프론트 EC2 배포](../frontend/README.md))
- [ ] 실패하면 그 job 만 재시도한다. backend 는 이전 image ID 로 자동 복구를 시도하지만 migration 은 되돌리지 않는다 — DB 가 반쯤 바뀌었으면 위 백업에서 복원할지 정한다

**확인 (운영 주소)**
- [ ] `https://backend.issue-atlas.kr/actuator/health` UP
- [ ] `https://ec2-prod.issue-atlas.kr/healthz` 의 revision 이 병합 커밋이다. `issue-atlas.kr` 은 DNS 를 바꾸기 전까지 Workers(옛 화면)라 여기서 보지 않는다
- [ ] 로그인 없이 `GET /v1/places` 200(시군구 6곳 `kr-*`), `GET /v1/places/kr-12130/boundaries` 200 — 10/30 판은 401 이었다(11/9 에도 401 확인)
- [ ] EC2 에서 `python3 deploy/dev/verify.py --base-url https://backend.issue-atlas.kr --session-auth`(관리자 로그인 · CSRF · 쿠키)
- [ ] `python deploy/dev/measure.py --base-url https://backend.issue-atlas.kr --question-runs 1` 로 질문 1건 · 응답 시간 표. 카드 시드가 없으면 질문 단계에서 멈춘다(위 결정대로)
- [ ] `ec2-prod.issue-atlas.kr` 에서 로그인 → 결과 화면 · `/admin`(관리자만)을 브라우저로 본다
- [ ] 개발 주소(dev-backend · dev)는 그대로 동작한다(환경 간 DB 분리)

**리허설 뒤 (별도 작업)**
- [ ] `issue-atlas.kr` DNS 를 Workers 에서 EC2 로 바꾸는 것은 [프론트 EC2 배포](../frontend/README.md) 5–6단계를 따른다(인증서 · Nginx 준비 → Worker Custom Domain 해제 → A 레코드). 코드 반영과 같은 날 하지 않아도 된다
- [ ] 걸린 시간 · 막힌 곳을 `docs/plans/active/perf-demo-response-time.md` 「진행」에 적는다

## 최초 GitLab 설정 (Maintainer 필요)

1. `issueatlas-docker` 태그의 Linux amd64 Docker executor Runner를 준비한다. 고정한 Docker-in-Docker 서비스만 privileged로 실행하고 일반 작업 컨테이너에는 허용하지 않는다. 사용 가능한 서버가 EC2 한 대이므로 동시 실행 1, CPU·메모리 제한, CI 전용 Docker daemon을 구성한다. 운영 DB·서비스 Docker socket·배포 키를 검사 컨테이너에 마운트하지 않는다. 같은 호스트에서 privileged 서비스를 실행하므로 완전한 보안 격리는 아니며 신뢰하는 팀 코드만 실행한다.
2. Docker Hub Private 저장소 `swcho25/issueatlas-backend`를 사용한다. GitLab의 Deploy·프로젝트 기능·Packages and registries 설정에는 Container Registry 항목이 없어 외부 저장소로 확정했다.
3. develop/main을 protected branch로 지정하고 직접 push를 금지한다. MR 단계에는 protected 배포 변수를 제공하지 않는다. MR의 protected 변수 접근 옵션도 끈다.
4. CI/CD File 변수 `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`를 protected·환경 범위 `*-ec2`로 등록한다. 전용 배포 키를 사용하며 서버 host key는 검증된 값으로 고정한다. CI 중 ssh-keyscan으로 신뢰를 새로 만들지 않는다.
5. 일반 변수 `DEPLOY_HOST=k15c108.p.ssafy.io`, `DEPLOY_USER=ubuntu`를 각 환경 범위에 등록한다.
6. 배포 환경의 오래된 작업 방지 옵션을 켜고 resource group 순서를 newest-ready-first로 지정할 수 있다. 서버 상한 검사가 최종 방어를 담당한다. 실제 첫 CI 성공 후 MR 병합 조건의 pipeline success를 활성화한다.

Docker Hub 변수는 다음처럼 등록한다. 토큰은 Masked·Hidden(지원 시)·Protected로 지정하고 변수 확장을 끈다. 계정 비밀번호 대신 만료일을 정한 Personal Access Token을 사용한다.

| 변수 | 값·권한 | 환경 범위 |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | `swcho25` | `*` |
| `DOCKERHUB_PUSH_TOKEN` | 이미지 업로드용 Read & Write 토큰, Protected | `*` |
| `DOCKERHUB_PULL_TOKEN` | 배포용 Read-only 토큰, Protected | `*-ec2` |

쓰기 토큰은 EC2 배포 프로그램에 전달하지 않는다. 서버는 읽기 토큰을 임시 Docker 설정에서만 사용하고 작업 후 삭제한다. 토큰 자체는 만료·폐기 전까지 유효하므로 GitLab 변수에서 별도로 갱신해야 한다. MR에서는 보호된 토큰을 제공하지 않는다.

## EC2 최초 설정 (서버 관리자)

### Runner 최초 설치 기록 (2026-10-26)

- 프로젝트 Runner #2252 `IssueAtlas EC2 Runner`, 태그 `issueatlas-docker`, 이 프로젝트에만 연결, untagged 작업 비활성화, 최대 작업 시간 1시간. MR 검사용이므로 Runner 자체는 protected 전용으로 제한하지 않는다. 배포 변수는 protected이며 MR의 보호 변수 접근은 비활성화했다.
- GitLab Runner 19.5.1 공식 `alpine` 이미지와 digest를 `runner/issueatlas-runner.service`에 고정했다.
- 운영 Docker는 기본 socket·저장 경로를 유지한다. CI 전용 daemon은 `/run/docker-ci.sock`, `/var/lib/docker-ci`, `docker-ci` bridge(10.240.0.1/24), 작업 네트워크 10.241.0.0/16을 사용한다. 다른 서버에 적용할 때는 기존 네트워크와 겹치지 않는지 먼저 확인한다.
- `issueatlas-ci.slice`로 daemon·Runner·작업 컨테이너 전체에 CPU 2개분·메모리 최대 8GB(7GB부터 회수 압력)·swap 0을 적용했다. 작업은 최대 1개, 작업 컨테이너 4GB, dind 서비스 3GB다. 디스크는 서비스와 공유하며 용량을 자동 제한하지 않는다.
- 비밀 없는 원본은 `runner/`에 있다. daemon.json은 `/etc/docker-ci/daemon.json`, slice와 service 파일은 `/etc/systemd/system/`에 설치한다. `config.template.toml`은 `/etc/issueatlas/runner/`에 설치한다. 등록은 root로 `register.sh`에 토큰을 stdin으로 전달하며 실제 config.toml은 같은 디렉터리에 600 권한으로 생성한다. 토큰과 실제 config.toml은 저장소·작업 컨테이너에 넣지 않는다.
- Runner는 CI daemon에서 실행하며 **CI 전용 socket만** Runner 관리 컨테이너에 연결한다. 일반 작업 컨테이너에는 Docker socket이나 호스트 디렉터리를 연결하지 않는다.
- 두 서비스는 자동 시작을 켰다. Runner 인증 검증·GitLab Online/Idle·CI 컨테이너 및 dind 내부 컨테이너의 GitLab HTTPS 통신을 확인했다. 테스트 컨테이너는 제거했다. 실제 서버 재부팅과 MR 파이프라인 실행은 아직 검증하지 않았다.

두 Docker daemon의 공통 iptables 체인 처리로 서비스 bridge의 외부 통신 규칙이 누락될 수 있다. `runner/restore-service-egress.sh`를 `/usr/local/sbin/issueatlas-service-egress`에 root 소유로 설치하며, CI Docker unit의 ExecStartPost로 서비스 네트워크의 외부 접속과 응답을 유지한다. 2026-10-26 CI Docker/Runner 재시작 뒤 서비스 컨테이너의 외부 API 통신과 Runner 인증을 확인했다.

```bash
sudo systemctl status issueatlas-ci-docker issueatlas-runner
sudo docker -H unix:///run/docker-ci.sock ps
sudo docker -H unix:///run/docker-ci.sock exec issueatlas-runner gitlab-runner verify
sudo systemctl show issueatlas-ci.slice -p CPUQuotaPerSecUSec -p MemoryMax
```

기존 서비스는 `sudo docker ps`에서 확인한다. CI 작업 상태를 보려면 별도 `-H unix:///run/docker-ci.sock`을 사용한다. 인증을 포함할 수 있는 Runner config·로그 전체를 공유하지 않는다.

### 배포 프로그램 최초 설치 기록 (전환 시 위 137번 절차 우선)

2026-10-26 설치 완료: 배포 전용 Ed25519 공개키를 forced command로 등록했고, 개인키는 GitLab의 `SSH_PRIVATE_KEY` File 변수에만 보관한다. `SSH_KNOWN_HOSTS`도 File 형식이며 두 File 변수와 `DEPLOY_HOST`·`DEPLOY_USER`는 모두 Protected·`shared-ec2` 범위, 변수 확장 비활성화다. 기존 서버 키 fingerprint와 전용 키 SSH 인증을 확인했다. CI 전용 임시 컨테이너에서도 SSH 인증과 임의 명령 차단을 확인했다. 설치된 프로그램으로 Compose 합성·현재 이미지 조회·내부/외부 health 점검을 통과했으며 서비스 이미지는 교체하지 않았다. 실제 Registry pull·이미지 교체·실패 복구는 첫 파이프라인에서 검증한다.

기존 PostGIS·Spring·Tunnel과 `/opt/issueatlas-dev/deploy/dev/.env`는 유지한다. `deploy/dev/compose.release.yaml`을 기존 서버의 같은 경로에 추가한다. 기본/Tunnel 파일을 최신 소스로 덮어쓰는 작업과 DB 스키마 변경은 자동 배포에 포함하지 않는다.

아래 설치는 검토한 소스에서 서버 관리자가 한 번 수행한다. `/etc/issueatlas/cicd.json`은 `cicd.example.json`을 복사한다. image_repository는 `swcho25/issueatlas-backend`, registry_host는 `docker.io`다. 비밀번호는 넣지 않는다.

```bash
sudo install -o root -g root -m 755 deploy/ci/deploy_backend.py /usr/local/sbin/issueatlas-deploy.py
sudo install -o root -g root -m 600 deploy/ci/cicd.example.json /etc/issueatlas/cicd.json
```

전용 SSH 공개키를 ubuntu의 authorized_keys에 추가할 때 아래처럼 실행 명령을 제한한다. 해당 키로 임의 셸·포트 전달을 허용하지 않는다. root 소유의 배포 스크립트·설정과 Compose 파일은 일반 사용자/CI가 수정할 수 없게 관리한다.

```text
restrict,command="sudo -n /usr/bin/python3 /usr/local/sbin/issueatlas-deploy.py" ssh-ed25519 <전용 배포 공개키>
```

이 스크립트는 stdin JSON만 받으며 설정된 Registry 저장소의 digest, develop/main, revision label·프로젝트 label을 검증한다. 기존 PEM 키를 CI 변수에 재사용하지 않는다. 키 생성·등록과 sudo 권한은 서버 관리자가 검토해서 설정한다.

서버의 `/opt/issueatlas-dev`·`deploy`·`deploy/dev` 디렉터리와 Compose 파일은 root 소유로 관리한다. 해당 디렉터리는 root:ubuntu 750, Compose 파일은 root:root 644, 기존 `.env`는 root:root 600이다. 배포 프로그램은 환경 파일 경로를 명시하므로 SSH 접속 위치의 다른 `.env`를 사용하지 않는다. 설정 파일을 수동 갱신할 때는 sudo로 설치하고 소유권을 유지한다. CI는 이 파일들을 수정하지 않는다.

현재 일반 운영 명령에는 `compose.yaml`·`compose.tunnel.yaml`을 사용하지만, **CI 최초 배포 후 수동 갱신도 반드시 배포된 BACKEND_IMAGE와 compose.release.yaml을 포함**한다. 기본 `issueatlas-backend:dev`로 되돌아가지 않게 한다. 현재 버전은 `.deploy/current.json`, 마지막 시도/복구 결과는 `.deploy/last-result.json`에서 확인한다. 해당 파일에는 비밀번호를 저장하지 않는다.

## 배포·복구

- backend 이미지는 `$CI_COMMIT_SHA` 태그로 업로드하고 실제 배포에는 digest를 사용한다.
- backend만 `up --no-deps --no-build --pull never`로 갱신한다. PostGIS·cloudflared·볼륨을 재생성하지 않는다.
- 내부 health와 외부 HTTPS health 및 실제 실행 image ID를 확인한 후 성공 기록을 저장한다.
- 교체 후 오류가 나면 기존 로컬 image ID로 복구를 시도한다. 복구 성공 여부와 관계없이 해당 배포 job은 실패한다.
- DB 마이그레이션은 이미지 롤백으로 취소되지 않는다. 이전 코드와 호환되지 않는 migration은 별도 DB 복구가 필요하다. 자동으로 DB 볼륨을 삭제·복원하지 않는다.
- 단일 Spring 컨테이너 교체 중 잠깐 접속 중단·세션 초기화가 발생할 수 있다. 무중단 배포는 이번 범위에 포함하지 않는다.

## 검증과 현재 한계

```bash
python -m pip install PyYAML==6.0.3
python -m unittest discover -s deploy/tests -v
pnpm check:all
```

`test_ci_selection.py`는 실제 YAML의 reference·상속을 해석해 변경별 job과 필수 의존성을 확인한다. GitLab 서버의 CI Lint와 실제 파이프라인 검증을 대체하지는 않는다.

기존 BE·수집기·FE의 develop 자동 배포는 확인된 상태다. 113번의 변경 영역 선택은 로컬 배포 테스트 29건과 전체 pnpm 검사를 통과했으며, GitLab MR·병합 후 실행은 사용자 push 이후 확인한다. 로컬 선택 검사 성공을 실제 파이프라인 성공으로 표시하지 않는다.
