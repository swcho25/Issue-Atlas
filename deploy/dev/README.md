> 290번부터 백엔드 전용 주소도 Nginx·HTTPS 직접 연결이다. 현재 설치·전환·복구 절차는 [백엔드 프록시 운영](../backend/README.md)을 따른다. 개발 경로·DB 볼륨은 유지하고 운영은 별도 `/opt/issueatlas-prod`를 사용한다.

# EC2 개발 서버 운영: PostGIS·Spring·Nginx HTTPS

EC2의 `/opt/issueatlas-dev`에서 PostGIS·Spring을 실행한다. 실제 배포에는 **`compose.yaml`, `compose.https.yaml`, `compose.release.yaml`을 함께 사용한다.** 기본 파일만 적용하면 HTTPS 쿠키 설정이 빠질 수 있다. Nginx는 호스트에서 실행한다.

개발 Next.js는 별도 EC2 Compose, 운영 프론트는 main 전환 전까지 Workers에 있다. 프론트는 [별도 안내](../frontend/README.md), 모니터링은 [Grafana 안내](../monitoring/README.md), 수집 예약 실행은 [수집기 안내](../collector/README.md)를 따른다. RabbitMQ는 사용하지 않는다.

## 구성

- EC2 배치 경로: `/opt/issueatlas-dev`
- DB: digest 고정 `17-3.5-alpine` PostGIS 기반에 pgvector 0.8.7을 추가한 `database/Dockerfile`을 로컬·테스트와 함께 사용
- Spring: `backend/Dockerfile`에서 Java 21로 bootJar 빌드, UID 10001로 실행
- Nginx: 호스트 80/443, backend 전용 주소의 HTTPS 종료·루프백 전달
- 포트: EC2의 `127.0.0.1:5432`, `127.0.0.1:8080`에만 바인딩
- 네트워크: Compose 전용 네트워크. Spring은 `postgres:5432`로 접속
- 볼륨: `issueatlas-dev_postgres-data`. 컨테이너와 독립적으로 보존
- 로그: 서비스당 10MB × 3개
- 메모리 상한: PostGIS 2GB, Spring 2GB
- 재시작: `unless-stopped`. 서버 재부팅 검증은 별도 수행

현재 빌드/런타임은 같은 digest의 JDK 이미지를 사용한다. 런타임 JRE 경량화는 별도 작업으로 검토한다. Dockerfile의 bootJar는 기존 Testcontainers 테스트를 실행하지 않으며 실제 배포 검증과 자동화 테스트 전체 통과는 구분한다.

## 환경변수

`.env.example`의 이름을 기준으로 실제 `.env`를 서버에만 생성한다. 권한은 0600으로 제한한다. 비밀번호를 코드·커밋·로그·Jira에 붙이지 않는다. 서버 초기 설치 시 무작위 비밀번호를 생성했으며 덮어쓰지 않는다.

현재 초기 관리자 이메일은 `bootstrap-admin@issueatlas.local`이며 비밀번호는 서버의 `deploy/dev/.env`에서 서버 관리자가 직접 확인한다. 공유 개발 계정은 관리자 API로 별도 발급한다. 환경변수 비밀번호만 바꿔도 이미 생성된 계정 비밀번호가 변경되는 것은 아니다.

`.env.example`의 `SESSION_COOKIE_SECURE=false`는 로컬 HTTP 구성용이다. 서버는 HTTPS 추가 설정에서 `true`로 덮어쓰며, 인증 점검에는 HTTPS 주소를 사용한다.

## 실행·종료

아래 명령은 **EC2에서** 실행한다. 갱신할 소스·배포 설정을 서버에 먼저 반영한 후 빌드·실행한다. CI/CD 최초 설정·이미지 배포 방식은 [CI/CD 운영 안내](../ci/README.md)를 따른다. 실제 파이프라인이 연결되기 전에는 Git의 최신 변경이 자동 반영되지 않는다.

**CI 이미지 배포를 시작한 서버에서는 아래 소스 빌드 방식으로 갱신하지 않는다.** 배포된 digest와 `compose.release.yaml`을 함께 적용하는 CI/CD 절차를 사용한다. 현재 배포 버전은 `/opt/issueatlas-dev/.deploy/current.json`에 기록된다.

```bash
cd /opt/issueatlas-dev
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml config --quiet
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml up -d --build --wait --wait-timeout 240
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml ps
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml logs --tail 100 backend
```

Spring의 healthcheck는 TCP 포트의 연결 여부만 확인한다. `--wait` 통과만으로 외부 연결·인증 성공을 보장하지 않으므로 아래 HTTPS 점검을 별도로 실행한다.

전체 서비스를 중단할 때만 다음 명령을 사용한다. API도 중단되며, 일반 갱신에는 `down`이 필요하지 않다.

```bash
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml down
```

**`down -v`는 DB 볼륨까지 지우므로 사용하지 않는다.** 환경변수 비밀번호 변경만으로 기존 PostgreSQL 계정 비밀번호는 갱신되지 않는다.

기존 Flyway 파일을 수정하거나 DB에서 직접 테이블을 만들지 않는다. 마이그레이션 추가 번호는 백엔드 담당자와 협의한다.

## 논증 문장화 engine (S15P31C108-243)

- `engine` 서비스는 `engine/Dockerfile` 의 `api` 대상이다(uvicorn `api.main:app`, 8000). 호스트 포트를 열지 않는다. `engine` 네트워크에는 backend 만 같이 붙어 `http://engine:8000` 으로 부른다. DB 네트워크(default)와 cloudflared 에는 붙지 않는다. GMS 호출을 위해 밖으로 나가는 길만 있다.
- UID 10001, 읽기 전용 파일 시스템, `cap_drop: ALL`, no-new-privileges, 메모리 512MB · CPU 1 · PID 128. 상태 검사는 컨테이너 안에서 `GET /health`.
- 키: `GMS_API_KEY=` 한 줄만 든 서버 파일(`.env` 의 `ENGINE_ENV_FILE`, 기본 `/etc/issueatlas/engine.env`)을 `/app/.env` 에 읽기 전용으로 연결한다. 소유 10001:10001, 권한 400. 키를 환경변수 · 이미지 · 저장소 · CI 변수에 넣지 않는다. 운영 경로는 `/etc/issueatlas/production/engine.env` 로 따로 둔다.
- backend 는 `.env` 의 `ENGINE_URL` 이 비어 있으면 engine 을 부르지 않는다(카드 문구로 응답, 사유 `ENGINE_DISABLED`). 켜면 익명 질문 1건이 GMS 호출 1번이므로 **익명 질문 요청 수 제한과 문장화 연결 코드가 배포된 뒤에만** 켠다.
- 자동 배포는 develop 병합 때 `engine-image` → `engine-deploy` 가 engine 만 `--no-deps` 로 바꾼다. 운영(main)은 이번 범위가 아니다. 배포 기록은 `.deploy/engine/current.json`. 수동 갱신 때도 `BACKEND_IMAGE` 와 함께 이 파일의 `ENGINE_IMAGE` digest 를 넘긴다(compose.release.yaml 이 둘 다 요구한다).

### 처음 켜는 순서 (서버 관리자 · MR 병합 전)

순서를 지킨다. 새 compose.release.yaml 은 `ENGINE_IMAGE` 를 요구하므로, 배포 프로그램을 먼저 바꿔 두지 않으면 그 사이 병합된 backend 배포가 compose 검사에서 멈춘다.

1. 키 파일: `/etc/issueatlas/engine.env` 에 `GMS_API_KEY=` 를 채우고 `chown 10001:10001`, `chmod 400`.
2. 배포 프로그램: `deploy/ci/deploy_backend.py` 를 `/usr/local/sbin/issueatlas-deploy.py` 로 다시 설치하고, `/etc/issueatlas/cicd.json` 의 `environments.develop` 에만 `"engine_image_repository": "swcho25/issueatlas-backend"` 를 넣는다. 이 값이 없는 환경은 engine 배포를 거절한다.
3. 외부 통신 규칙: `deploy/ci/runner/restore-service-egress.sh` 를 `/usr/local/sbin/issueatlas-service-egress` 로 다시 설치한다(engine 네트워크 추가).
4. Compose: develop 의 `compose.yaml` · `compose.release.yaml` 을 `/opt/issueatlas-dev/deploy/dev/` 에 root 소유로 설치한다. 서버에는 저장소가 없으므로 2 · 3 · 4 의 파일은 PC 에서 `git show origin/develop:<경로>` 로 꺼내 scp 로 보낸다. `.env` 에 `ENGINE_URL=`(빈 값)을 두고, 키 파일이 기본 경로가 아니면 `ENGINE_ENV_FILE` 도 적는다.
5. 병합 → `engine-deploy` 성공 확인. 준비 전에 병합돼 `Unsupported deployment component` 로 실패했다면 1~4 를 마친 뒤 그 job 을 재시도한다. engine 네트워크가 이때 처음 생기므로 `sudo /usr/local/sbin/issueatlas-service-egress` 를 한 번 실행한다.
6. 확인: engine 이 healthy 이고 GMS 에 닿는지 본다.

```bash
sudo docker ps --filter name=issueatlas-dev-engine --format '{{.Names}} {{.Status}}'
sudo docker exec issueatlas-dev-engine-1 python -c "import socket; socket.create_connection(('gms.ssafy.io', 443), timeout=5); print('GMS 연결 OK')"
```

`engine-deploy` 는 engine 만 만들고 backend 컨테이너는 그대로 둔다. 그래서 backend 는 다시 만들어질 때(아래 「켜기」 또는 다음 backend 배포)까지 engine 네트워크에 붙지 않는다. `ENGINE_URL` 이 비어 있는 동안에는 문제가 없다. backend → engine 확인은 「켜기」 뒤에 한다.

개발 서버 적용: 2026-11-05. 병합이 먼저 돼 첫 `engine-deploy` 가 실패했고, 1~4 뒤 재시도로 성공했다(job 833501).

### 켜기 (나중)

문장화 연결(!140)과 익명 질문 요청 수 제한(!142)이 develop 에 병합 · 배포됐는지 먼저 확인한다. 그 뒤 `.env` 에 `ENGINE_URL=http://engine:8000` 을 쓰고 backend 만 다시 만든다.

```bash
cd /opt/issueatlas-dev
export BACKEND_IMAGE=$(sudo python3 -c "import json;print(json.load(open('.deploy/current.json'))['image'])")
export ENGINE_IMAGE=$(sudo python3 -c "import json;print(json.load(open('.deploy/engine/current.json'))['image'])")
sudo -E docker compose --env-file deploy/dev/.env -f deploy/dev/compose.yaml -f deploy/dev/compose.https.yaml -f deploy/dev/compose.routing.yaml -f deploy/dev/compose.release.yaml up -d --no-deps --no-build --pull never --wait backend
```

backend 가 engine 네트워크에 붙었는지 확인한다.

```bash
sudo docker exec issueatlas-dev-backend-1 bash -c 'echo > /dev/tcp/engine/8000' && echo 'backend→engine OK'
```

끌 때는 `ENGINE_URL=` 로 비우고 같은 명령을 다시 실행한다.

## 개발 PC의 DB 접속

DB는 외부에 공개하지 않는다. Windows PowerShell에서 SSH 터널을 열고 유지한다. 키 경로는 각 개발자 환경에 맞게 지정한다.

```powershell
ssh -i '<PEM 파일 경로>' -L 15432:127.0.0.1:5432 -N ubuntu@k15c108.p.ssafy.io
```

DB 도구에는 호스트 `localhost`, 포트 `15432`와 별도로 전달받은 DB명·계정을 입력한다. API·Swagger는 아래 HTTPS 주소로 접근한다.

## 백엔드 Nginx / HTTPS

개발은 `https://dev-backend.issue-atlas.kr`, 운영은 `https://backend.issue-atlas.kr`을 사용한다. `/v1/**`, `/swagger-ui/index.html`, `/actuator/health` 경로는 유지한다. DNS only → EC2 Nginx → 환경별 루프백 Spring이며, 인증서 선발급·갱신·Tunnel 제거·복구는 [290번 안내](../backend/README.md)를 따른다. Swagger 공개 범위와 API의 인증·ADMIN·CSRF 정책은 바꾸지 않는다.

## 배포 후 점검

EC2에서 다음을 실행한다.

```bash
cd /opt/issueatlas-dev
# 상태·미인증 접근 차단만 확인
python3 deploy/dev/verify.py --base-url https://dev-backend.issue-atlas.kr
# 기존 ADMIN으로 로그인·세션·CSRF·쿠키·캐시 방지·로그아웃까지 확인
python3 deploy/dev/verify.py --base-url https://dev-backend.issue-atlas.kr --session-auth
```

`--session-auth`는 테스트 계정을 만들지 않고 자격 증명을 출력하지 않는다. 기존 `--auth`는 HTTP 초기 구축용으로 VIEWER 계정을 생성·비활성화하는 모드이며, 현재 HTTPS 운영 점검에는 사용하지 않는다. Secure 세션 쿠키는 일반 HTTP SSH 터널에서 전송되지 않는다.

검증 완료: HTTPS health UP, 미인증 me 401, CSRF 없는 로그인 403, ADMIN 로그인·세션 유지·로그아웃, Secure 쿠키 및 HttpOnly/SameSite=Lax 세션, 응답 no-store·캐시 HIT 없음, HTTP→HTTPS 전환, Swagger 브라우저 로딩.

아직 검증하지 않은 항목: 실제 프론트 로그인·SSR/Next.js 프록시 연동, Swagger 인증된 쓰기 호출, 서버 재부팅. 전체 자동화 테스트와 세션 재시작 정책도 별도 검증 대상이다.

## 배포 소스 관리

이번 최초 배치는 로컬의 backend 소스·Dockerfile·배포 구성만 묶어 전송했다. pgvector 적용 배포에는 `database/Dockerfile`도 포함해야 한다. `.env`·키·빌드 캐시는 전송하지 않았다. Git 커밋·push·MR·CI/CD는 아직 수행하지 않았다. 다음 배포부터는 팀의 리뷰·이미지 버전 관리·자동 배포 절차에 연결한다.
# 개발 DB 자동 백업

`deploy/backup/`의 Python 프로그램과 systemd service/timer를 서버에 설치한다.
개발 DB만 매일 04:00 Asia/Seoul에 전체 백업하고 성공한 최신 7개를 보관한다.
서버가 꺼져 실행을 놓치면 기동 후 한 번 실행한다. 운영 DB는 이 작업 대상이 아니다.

- 경로: `/var/backups/issueatlas/daily/development/<UTC 날짜시간>/database.dump`
- 같은 폴더 `manifest.json`: 생성 시각, 크기, SHA256, 검사 종류.
- 중복 실행 잠금, 여유 공간 검사, 실패 시 임시 파일 정리. 새 백업 성공 후에만 오래된 자동 백업 삭제.
- 기존 수동/복원 검증 백업은 위 경로 밖에 보관하며 자동 삭제하지 않는다.
- 컨테이너 내부 DB 환경변수를 사용한다. 비밀번호/환경 파일을 호스트로 출력하지 않는다.
- archive 전체 읽기 검사는 복원 검증과 다르다. 중요한 변경 뒤에는 별도 임시 DB에서 실제 복원을 확인한다.
- DB 역할·권한은 복원 대상에서 제외한다. 동일 EC2의 백업이므로 서버 자체 손실에는 대비하지 못한다.

서버 설치(root): `backup_database.py`를 `/usr/local/sbin/issueatlas-db-backup.py`에
0755로, service/timer를 `/etc/systemd/system/`에 0644로 복사한다.
백업 경로를 root 소유 0700으로 만든 뒤 `systemctl daemon-reload`,
`systemctl enable --now issueatlas-db-backup.timer`를 실행한다. 코드 변경은 자동 CD로 설치되지 않는다.

```sh
sudo systemctl start issueatlas-db-backup.service  # 즉시 백업 (복원 아님)
sudo systemctl status issueatlas-db-backup.service
sudo systemctl list-timers issueatlas-db-backup.timer
sudo journalctl -u issueatlas-db-backup.service --since yesterday
sudo systemctl disable --now issueatlas-db-backup.timer  # 이후 예약 중단
```

복원 시 원하는 날짜의 파일을 고르고 SHA256을 manifest와 대조한다. 현재 DB를 먼저
별도 백업한 뒤 동일 PostgreSQL/PostGIS/pgvector 버전의 `template0` 기반 임시 DB에서
복원·건수 검증 후 실제 DB에 반영한다. 자동 복원/운영 DB 덮어쓰기는 제공하지 않는다.
실패는 systemd failed 상태와 journal에 남으며 외부 알림 전송은 설정하지 않는다.
