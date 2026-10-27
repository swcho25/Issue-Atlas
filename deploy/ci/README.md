# 백엔드 CI/CD — S15P31C108-103

수집기 이미지 자동 갱신·수동 실행은 [수집기 배포](../collector/README.md)를 참고한다.

## 실행 조건

| 이벤트 | 동작 |
| --- | --- |
| develop/main 대상 MR 생성·갱신 | 검사만, 배포 작업 없음 |
| 보호된 develop/main에 병합(push 파이프라인) | 검사 → 이미지 업로드 → 같은 EC2에 자동 배포 |
| 다른 브랜치 push·태그·스케줄·웹 수동 파이프라인 | 실행 안 함 |

두 브랜치는 하나의 `shared-ec2` 환경·`issueatlas-ec2` resource group을 사용한다. 서버에서도 파일 잠금과 공통 pipeline ID 상한으로 오래된 작업을 거부한다. 마지막으로 성공한 배포가 실행되며 main이 항상 우선하는 구조가 아니다. 수동 direct push도 기술적으로 push 이벤트이므로 **develop/main의 직접 push를 금지하고 MR로만 병합**하도록 보호해야 한다.

## 최초 GitLab 설정 (Maintainer 필요)

1. `issueatlas-docker` 태그의 Linux amd64 Docker executor Runner를 준비한다. 고정한 Docker-in-Docker 서비스만 privileged로 실행하고 일반 작업 컨테이너에는 허용하지 않는다. 사용 가능한 서버가 EC2 한 대이므로 동시 실행 1, CPU·메모리 제한, CI 전용 Docker daemon을 구성한다. 운영 DB·서비스 Docker socket·배포 키를 검사 컨테이너에 마운트하지 않는다. 같은 호스트에서 privileged 서비스를 실행하므로 완전한 보안 격리는 아니며 신뢰하는 팀 코드만 실행한다.
2. Docker Hub Private 저장소 `swcho25/issueatlas-backend`를 사용한다. GitLab의 Deploy·프로젝트 기능·Packages and registries 설정에는 Container Registry 항목이 없어 외부 저장소로 확정했다.
3. develop/main을 protected branch로 지정하고 직접 push를 금지한다. MR 단계에는 protected 배포 변수를 제공하지 않는다. MR의 protected 변수 접근 옵션도 끈다.
4. CI/CD File 변수 `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`를 protected·환경 범위 `shared-ec2`로 등록한다. 전용 배포 키를 사용하며 서버 host key는 검증된 값으로 고정한다. CI 중 ssh-keyscan으로 신뢰를 새로 만들지 않는다.
5. 일반 변수 `DEPLOY_HOST=k15c108.p.ssafy.io`, `DEPLOY_USER=ubuntu`를 같은 환경 범위에 등록한다.
6. 배포 환경의 오래된 작업 방지 옵션을 켜고 resource group 순서를 newest-ready-first로 지정할 수 있다. 서버 상한 검사가 최종 방어를 담당한다. 실제 첫 CI 성공 후 MR 병합 조건의 pipeline success를 활성화한다.

Docker Hub 변수는 다음처럼 등록한다. 토큰은 Masked·Hidden(지원 시)·Protected로 지정하고 변수 확장을 끈다. 계정 비밀번호 대신 만료일을 정한 Personal Access Token을 사용한다.

| 변수 | 값·권한 | 환경 범위 |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | `swcho25` | `*` |
| `DOCKERHUB_PUSH_TOKEN` | 이미지 업로드용 Read & Write 토큰, Protected | `*` |
| `DOCKERHUB_PULL_TOKEN` | 배포용 Read-only 토큰, Protected | `shared-ec2` |

쓰기 토큰은 EC2 배포 프로그램에 전달하지 않는다. 서버는 읽기 토큰을 임시 Docker 설정에서만 사용하고 작업 후 삭제한다. 토큰 자체는 만료·폐기 전까지 유효하므로 GitLab 변수에서 별도로 갱신해야 한다. MR에서는 보호된 토큰을 제공하지 않는다.

## EC2 최초 설정 (서버 관리자)

### Runner 설치 상태 (2026-10-26)

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

### 배포 프로그램 설정

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
python -m unittest discover -s deploy/tests -v
pnpm check:all
```

실제 Runner 실행, Registry push/pull, 전용 SSH 접속과 최초 자동 배포는 GitLab 설정·사용자의 브랜치 push 이후에 검증한다. 로컬 단위 검사 성공을 실제 파이프라인 성공으로 표시하지 않는다. setup 완료 전에는 현재 수동 배포 서버가 그대로 실행된다.
