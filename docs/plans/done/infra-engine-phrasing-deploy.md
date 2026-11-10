# infra/engine-phrasing-deploy — 논증 문장화 engine 을 개발 서버에 띄우고 backend 가 부르게 한다

- Jira: S15P31C108-243 (상위 -162) · 묶음: P4 · 리뷰: 인프라 담당 조석원

## 완료 조건
- [x] engine/Dockerfile 에 문장화 API 대상을 추가하고, 수집기 기본 이미지는 그대로 동작한다
- [x] deploy/dev compose 에 engine 서비스를 추가한다(포트 공개 없음, backend 하고만 연결, 키는 env 파일을 읽기 전용으로 연결, read_only·cap_drop, /health 상태 검사). backend 의 ENGINE_URL 은 서버 .env 값(기본 비움)
- [x] CI 가 develop 병합 때 engine 이미지를 digest 로 만들어 개발 서버에만 배포한다(운영은 범위 밖)
- [x] deploy 테스트·pnpm check·compose config 를 통과하고, 로컬에서 engine /health 와 backend→engine 호출을 확인한다

## 진행
- 2026-11-04: 시작. !140(-231 문장화 연결)·!142(익명 질문 요청 수 제한) 모두 develop 미병합 확인(origin/develop ba74bda). 개발 서버 API 목록에도 문장화 칸 없음. 그래서 engine 서비스까지만 띄우고 ENGINE_URL 은 기본 비움으로 둔다(사용자 확인)
- 2026-11-04: 구현
  - Dockerfile: 공통 `base` → `api`(uvicorn, pipeline 없음) · `collector`(마지막 = 기본 대상, 기존 CI 빌드 명령 그대로)
  - compose: engine 은 `engine` 네트워크만(backend 와 둘), 호스트 포트 없음, DB 네트워크 · cloudflared 와 분리. 키 파일(`ENGINE_ENV_FILE`)을 `/app/.env` 에 읽기 전용. release 파일은 `ENGINE_IMAGE` digest 를 요구
  - 배포 프로그램: `EngineDeployment`(기록 `.deploy/engine/`, 상태는 compose healthcheck), `deployment_for` 로 구성 요소 선택. 설정에 `engine_image_repository` 가 있는 환경만 허용(예시는 develop 만). compose 가 대상 아닌 서비스의 필수 변수도 검사하므로(직접 확인) 배포마다 두 서비스의 현재 digest 를 기록에서 넘기고, engine 첫 배포 전에는 대체값을 쓴다
  - CI: `.engine-release`(develop 보호 push 만) · `engine-image`(api 대상 빌드, 네트워크 없이 `import api.main`) · `engine-deploy`. 외부 통신 복원 스크립트에 engine 네트워크 추가
  - 결정: engine-deploy 는 backend-deploy 를 기다리지 않는다. backend 는 engine 이 없거나 옛 판이면 카드 문구로 응답하므로(ENGINE_*) 묶지 않았다
- 2026-11-04: 검증
  - deploy 테스트 59건 PASS(새 test_engine_deploy 13건), `corepack pnpm check` PASS(engine lint · pytest 566), harness PASS
  - `docker compose config`: 서버 구성(base+tunnel+routing+release) · 운영 구성 OK, ENGINE_IMAGE 없으면 실패, 대체값이면 OK
  - 이미지: collector CI smoke(fixture export) · 배포 smoke(`--help`) PASS(새 · 옛 Dockerfile 모두). Git Bash 가 `/app/...` 인자를 바꿔 처음엔 실패처럼 보였음 → `MSYS_NO_PATHCONV=1`. engine 이미지는 UID 10001, pipeline 없음, `/app/.env` 없음
  - 로컬 스택(postgres + !140 backend + !140 engine, 임시 worktree 에서 이미지만 빌드, 키 없음): engine healthy · 호스트 포트 없음 · postgres 이름 못 찾음 · backend 에서 `/health` 200. C1·A3 승인 시드 뒤 익명 질문 → backend 가 `POST /v1/argument/phrase` 호출, 기록 `skipped RUN_BLOCKED`(engine 이 돌려준 사유, GMS 안 부름). ENGINE_URL 비우고 backend 재생성 → `ENGINE_DISABLED`, engine 호출 없음
  - 배포 프로그램의 `apply`/`healthy` 를 실제 Compose 에 돌림: engine 두 판 교체 · healthy · 실행 이미지 일치, backend 재시작 없음. 확인 뒤 스택 · 볼륨 · 임시 worktree · 이미지 정리
- 2026-11-04: 개발 서버 `docker ps` 로 engine 컨테이너가 없음을 확인(사용자). 박준우 님 배포는 수집기 이미지(-233, 배치) 쪽. 이 MR 은 마이그레이션이 없고, 기준 커밋 뒤 develop 이 같은 파일을 바꾸지 않았다. MR 열기(리뷰 조석원)
- 2026-11-05: 서버 준비 전에 develop 병합(b946460) → 병합 파이프라인 #267651 의 `engine-deploy` 만 실패(서버의 옛 배포 프로그램이 `Unsupported deployment component`). 나머지 12 job 성공. 사용자가 서버 준비(키 파일 · 배포 프로그램 · cicd.json · egress · compose · .env)를 마친 뒤 job 재시도 → 833501 성공(`Deployed engine develop b946460…`), 파이프라인 통과
- 2026-11-05: README 확인 단계 정정(docs/engine-deploy-check). engine 만 배포되면 backend 는 다시 만들어질 때까지 engine 네트워크에 붙지 않으므로 backend → engine 확인을 「켜기」 뒤로 옮김. 실패 시 재시도 안내 · 서버로 파일 보내는 법 추가

## 다음 할 일 / 범위 밖
- 서버 준비(조석원, 병합 전): deploy/dev/README.md 「처음 켜는 순서」. 배포 프로그램을 compose 파일보다 먼저 설치해야 한다
- 서버에서 켜기: !140·!142 병합 · 배포 뒤 서버 `deploy/dev/.env` 에 `ENGINE_URL=http://engine:8000`(README 「켜기」)
- 운영(main) engine 배포는 별도 MR(`.engine-release` 규칙 · cicd.json production 에 저장소 추가 · 운영 키 파일)
- 실제 GMS 호출이 되는 문장화(done)는 서버 키로 켠 뒤 확인. 로컬에서는 키를 쓰지 않았다
- !140 의 `V0044__create_argument_phrasing.sql` 이 develop 의 `V0044__drop_press_release.sql`(-240)과 번호가 겹친다. develop 최신이 V0045 라 !140 은 병합 전에 V0046 으로 바꿔야 한다(!140 쪽 일)
