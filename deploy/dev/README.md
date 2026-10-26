# EC2 개발 서버 운영: PostGIS·Spring·Cloudflare Tunnel

현재 EC2의 `/opt/issueatlas-dev`에서 PostGIS·Spring·cloudflared를 실행한다. 실행·갱신·종료에는 **`compose.yaml`과 `compose.tunnel.yaml`을 항상 함께 사용한다.** 기본 파일만 적용하면 HTTPS 쿠키·프록시 설정이 빠질 수 있다.

프론트는 Next.js SSR을 위한 Cloudflare Workers 배포 예정이며, 현재 EC2 구성에 포함하지 않는다. RabbitMQ·정기 수집·Prometheus도 아직 구성하지 않았다.

## 구성

- EC2 배치 경로: `/opt/issueatlas-dev`
- PostGIS: 저장소 로컬·테스트와 동일한 `17-3.5-alpine` 이미지/digest
- Spring: `backend/Dockerfile`에서 Java 21로 bootJar 빌드, UID 10001로 실행
- cloudflared: `2026.10.3` 이미지/digest 고정, Cloudflare Tunnel 연결
- 포트: EC2의 `127.0.0.1:5432`, `127.0.0.1:8080`에만 바인딩
- 네트워크: Compose 전용 네트워크. Spring은 `postgres:5432`로 접속
- 볼륨: `issueatlas-dev_postgres-data`. 컨테이너와 독립적으로 보존
- 로그: 서비스당 10MB × 3개
- 메모리 상한: PostGIS 2GB, Spring 2GB, cloudflared 256MB
- 재시작: `unless-stopped`. 서버 재부팅 검증은 별도 수행

현재 빌드/런타임은 같은 digest의 JDK 이미지를 사용한다. 런타임 JRE 경량화는 별도 작업으로 검토한다. Dockerfile의 bootJar는 기존 Testcontainers 테스트를 실행하지 않으며 실제 배포 검증과 자동화 테스트 전체 통과는 구분한다.

## 환경변수

`.env.example`의 이름을 기준으로 실제 `.env`를 서버에만 생성한다. 권한은 0600으로 제한한다. 비밀번호를 코드·커밋·로그·Jira에 붙이지 않는다. 서버 초기 설치 시 무작위 비밀번호를 생성했으며 덮어쓰지 않는다.

현재 초기 관리자 이메일은 `bootstrap-admin@issueatlas.local`이며 비밀번호는 서버의 `deploy/dev/.env`에서 서버 관리자가 직접 확인한다. 공유 개발 계정은 관리자 API로 별도 발급한다. 환경변수 비밀번호만 바꿔도 이미 생성된 계정 비밀번호가 변경되는 것은 아니다.

`.env.example`의 `SESSION_COOKIE_SECURE=false`는 기본 HTTP 구성용이다. 현재 서버는 Tunnel 추가 설정에서 `true`로 덮어쓰며, 인증 점검에는 HTTPS 주소를 사용한다.

## 실행·종료

아래 명령은 **EC2에서** 실행한다. 갱신할 소스·배포 설정을 서버에 먼저 반영한 후 빌드·실행한다. CI/CD 최초 설정·이미지 배포 방식은 [CI/CD 운영 안내](../ci/README.md)를 따른다. 실제 파이프라인이 연결되기 전에는 Git의 최신 변경이 자동 반영되지 않는다.

**CI 이미지 배포를 시작한 서버에서는 아래 소스 빌드 방식으로 갱신하지 않는다.** 배포된 digest와 `compose.release.yaml`을 함께 적용하는 CI/CD 절차를 사용한다. 현재 배포 버전은 `/opt/issueatlas-dev/.deploy/current.json`에 기록된다.

```bash
cd /opt/issueatlas-dev
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml config --quiet
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml up -d --build --wait --wait-timeout 240
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml ps
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml logs --tail 100 backend cloudflared
```

Spring의 healthcheck는 TCP 포트의 연결 여부만 확인한다. `--wait` 통과만으로 외부 연결·인증 성공을 보장하지 않으므로 아래 HTTPS 점검을 별도로 실행한다. Tunnel은 Cloudflare 대시보드에서도 `Healthy` 상태인지 확인한다.

전체 서비스를 중단할 때만 다음 명령을 사용한다. API·Tunnel도 중단되며, 일반 갱신에는 `down`이 필요하지 않다.

```bash
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml down
```

**`down -v`는 DB 볼륨까지 지우므로 사용하지 않는다.** 환경변수 비밀번호 변경만으로 기존 PostgreSQL 계정 비밀번호는 갱신되지 않는다.

기존 Flyway 파일을 수정하거나 DB에서 직접 테이블을 만들지 않는다. 마이그레이션 추가 번호는 백엔드 담당자와 협의한다.

## 개발 PC의 DB 접속

DB는 외부에 공개하지 않는다. Windows PowerShell에서 SSH 터널을 열고 유지한다. 키 경로는 각 개발자 환경에 맞게 지정한다.

```powershell
ssh -i '<PEM 파일 경로>' -L 15432:127.0.0.1:5432 -N ubuntu@k15c108.p.ssafy.io
```

DB 도구에는 호스트 `localhost`, 포트 `15432`와 별도로 전달받은 DB명·계정을 입력한다. API·Swagger는 아래 HTTPS 주소로 접근한다.

## Cloudflare Tunnel / HTTPS (2026-10-23 연결)

- Tunnel: `issueatlas-backend` (`685285ca-301a-478c-b6bd-59eccbf41ad7`), cloudflared 2026.10.3 tag/digest 고정
- 공개 주소: `https://backend.issue-atlas.kr` → 같은 Compose 네트워크의 `http://backend:8080`
- Cloudflare가 생성한 proxied CNAME으로 연결한다. EC2 공인 IP를 향하는 A 레코드는 사용하지 않는다.
- Cloudflare의 `Always Use HTTPS`는 **issue-atlas.kr 영역 전체**에 적용됐다. HTTP 요청은 HTTPS로 301 전환된다.
- 외부 HTTPS → Cloudflare와 EC2 사이 암호화 Tunnel → EC2 내부 Compose HTTP 구간이다.
- 추가 구성은 `SESSION_COOKIE_SECURE=true`, `SERVER_FORWARD_HEADERS_STRATEGY=framework`를 적용한다. Spring 직접 포트는 loopback으로 유지하여 외부에서 forwarded headers를 직접 주입할 수 없도록 한다.
- 토큰은 EC2의 `/etc/issueatlas/cloudflared-token` 파일에만 보존한다. 파일 소유자 65532:65532, 권한 0400, 부모 디렉터리 root 0700. 컨테이너에 읽기 전용 마운트한다. 토큰을 명령줄·환경변수·저장소·로그에 넣지 않는다.
- 백엔드와 DB의 호스트 포트는 계속 127.0.0.1에만 바인딩한다. cloudflared 포트는 호스트에 공개하지 않는다.

- 상태 확인: `https://backend.issue-atlas.kr/actuator/health`
- Swagger: `https://backend.issue-atlas.kr/swagger-ui/index.html`
- API: `https://backend.issue-atlas.kr/v1/...`

Swagger 문서는 현재 공개 상태지만 API의 인증·ADMIN·CSRF 정책은 유지한다. 인증된 쓰기 API를 실행하려면 CSRF 전달 설정을 별도로 확인해야 한다. 운영 단계의 문서 공개 범위는 팀과 협의한다.

토큰 유출 시 Cloudflare에서 Rotate token 후 새 토큰 파일로 교체하고 cloudflared 컨테이너를 재생성한다. 파일을 교체하면 기존 bind mount가 이전 파일을 가리킬 수 있어 단순 프로세스 재시작보다 컨테이너 재생성을 사용한다.

```bash
sudo docker compose -f deploy/dev/compose.yaml -f deploy/dev/compose.tunnel.yaml up -d --force-recreate --no-deps cloudflared
```

## 배포 후 점검

EC2에서 다음을 실행한다.

```bash
cd /opt/issueatlas-dev
# 상태·미인증 접근 차단만 확인
python3 deploy/dev/verify.py --base-url https://backend.issue-atlas.kr
# 기존 ADMIN으로 로그인·세션·CSRF·쿠키·캐시 방지·로그아웃까지 확인
python3 deploy/dev/verify.py --base-url https://backend.issue-atlas.kr --session-auth
```

`--session-auth`는 테스트 계정을 만들지 않고 자격 증명을 출력하지 않는다. 기존 `--auth`는 HTTP 초기 구축용으로 VIEWER 계정을 생성·비활성화하는 모드이며, 현재 HTTPS 운영 점검에는 사용하지 않는다. Secure 세션 쿠키는 일반 HTTP SSH 터널에서 전송되지 않는다.

검증 완료: HTTPS health UP, 미인증 me 401, CSRF 없는 로그인 403, ADMIN 로그인·세션 유지·로그아웃, Secure 쿠키 및 HttpOnly/SameSite=Lax 세션, 응답 no-store·캐시 HIT 없음, HTTP→HTTPS 전환, Swagger 브라우저 로딩.

아직 검증하지 않은 항목: 실제 프론트 로그인·SSR/Next.js 프록시 연동, Swagger 인증된 쓰기 호출, 서버 재부팅. 전체 자동화 테스트와 세션 재시작 정책도 별도 검증 대상이다.

## 배포 소스 관리

이번 최초 배치는 로컬의 backend 소스·Dockerfile·배포 구성만 묶어 전송했다. `.env`·키·빌드 캐시는 전송하지 않았다. Git 커밋·push·MR·CI/CD는 아직 수행하지 않았다. 다음 배포부터는 팀의 리뷰·이미지 버전 관리·자동 배포 절차에 연결한다.
