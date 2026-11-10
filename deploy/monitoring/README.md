# 서버 모니터링 (S15P31C108-273)

Prometheus·Grafana로 EC2, 서비스 컨테이너, Spring을 조회한다. 알림·로그 수집은 포함하지 않는다.

## 수집 범위

| 대상 | 지표 |
| --- | --- |
| EC2 | CPU 사용률·load, 가용 메모리, 루트 디스크 사용률·I/O, 물리 인터페이스 수신량 |
| 서비스 Docker | 개발·운영 FE·backend·DB·engine의 CPU 코어 수, 메모리와 설정 상한 |
| HTTP health | 개발 FE, 개발·운영 backend의 내부 HTTP 200 여부 |
| Spring | 요청 수, 5xx 비율, 평균·p95 처리 시간, JVM heap·GC, Hikari 연결 풀 |

환경 선택은 `development` / `production`. EC2 전체 자원은 CI 부하도 포함하지만 cAdvisor는 서비스 Docker만 수집한다. HTTP 지표는 서버가 요청을 처리한 시간이며 브라우저 렌더링·외부 회선 지연·로컬 모델 분류 시간이 아니다. 요청이 없는 구간의 평균·p95는 데이터 없음이 정상이다. URI는 Spring의 경로 템플릿을 사용하며 사용자 질문·쿼리·인증 정보는 수집하지 않는다.

운영 FE는 아직 EC2에 배포하지 않았으므로 health 대상에서 제외했다. 최초 운영 FE 배포 후 `prometheus.yml`의 health 대상에 `http://issueatlas-production-frontend-frontend-1:3000/healthz`, `environment: production`, `service: frontend`를 추가하고 Prometheus를 재시작한다. DB health는 별도 SQL exporter 없이 backend health의 DB 검사와 컨테이너 자원 지표로 확인한다. engine은 컨테이너 자원만 수집한다.

## 설치

서버의 신뢰할 수 있는 체크아웃에서 `sudo sh deploy/monitoring/install.sh` 실행. `/opt/issueatlas-monitoring`에 구성, Docker 볼륨에 지표·Grafana 데이터를 보존한다. 기존 구성은 `/var/backups/issueatlas-monitoring-*`에 백업한다. 이미지 태그와 digest는 함께 갱신한다. 스크립트는 애플리케이션을 재시작하지 않는다.

Spring 구성은 backend CD 후 활성화된다. 서버 개발·운영 compose의 backend environment에 `MONITORING_ENABLED: "true"`, `MONITORING_PORT: "9091"`이 있어야 한다. 새 compose 파일을 설치할 때 기존 서버 구성을 먼저 비교하고 보존한다. compose를 읽는 것만으로 기존 컨테이너 환경변수가 바뀌지 않으며 해당 환경의 다음 backend CD에서 적용된다. 두 네트워크 `issueatlas-dev_default`, `issueatlas-prod_default`가 이미 있어야 한다.

Spring은 **8080에서 기존 health·인증을 유지**하고, 추가 내부 포트 9091에서 `GET /actuator/prometheus`만 제공한다. 9091은 호스트 publish 금지. 8080의 지표 접근과 9091의 일반 API 접근은 보안 필터가 차단한다. main에 병합하기 전 운영 Spring 지표가 연결되지 않는 것은 예상 상태이며, HTTP health와 구분해서 본다.

30초 간격, 보존 기간 7일·크기 2GB 중 먼저 도달하는 제한을 적용한다. 디스크 제한은 WAL·압축 중 임시 파일까지 포함하는 절대 상한이 아니다. 전체 메모리 상한 합계 약 1.4GiB, CPU 상한 합계 2코어다. root 디스크 여유와 실제 사용량을 같이 확인한다.

## 접속

팀 공용 주소: **https://grafana.issue-atlas.kr/**. SSH 연결 없이 브라우저에서 로그인한다. 개발·운영 서비스 모두 같은 Grafana의 환경 선택으로 조회한다.

사용자명 `admin`은 초기 운영자 전용이다. 최초 비밀번호는 서버에서 본인 터미널로 `sudo cat /etc/issueatlas/monitoring/grafana-admin-password`로 확인한다. 채팅·저장소에 공유하지 않는다. 최초 로그인 후 바꾼 비밀번호는 Grafana 볼륨에 저장되며 초기 파일 변경만으로 재설정되지 않는다. Spring 관리자와는 별도 계정이다.

팀원은 운영자가 Grafana의 사용자 관리에서 개별 계정을 만들고 **Viewer** 역할을 부여한다. 공용 admin 계정을 배포하지 않는다. 자체 회원가입·익명 조회는 비활성화되어 있다. Viewer는 대시보드와 연결된 Prometheus 지표를 조회할 수 있으며, 개발·운영 지표를 모두 볼 수 있다. 메일 발송은 설정하지 않았으므로 이메일 초대·비밀번호 재설정 메일에 의존하지 않는다.

### 도메인·HTTPS 최초 연결

1. Cloudflare에 DNS only A 레코드 `grafana` → EC2 공인 IP를 추가한다. Worker·Tunnel은 사용하지 않는다.
2. 기존 Nginx·Certbot이 있는 서버에서 `sudo sh deploy/monitoring/install-web.sh` 실행. 기존 Certbot 계정을 사용하여 HTTP webroot 인증서 발급 후 `nginx.conf`를 설치한다. 80은 인증서 갱신과 HTTPS 전환에만 사용하고, 443은 내부 Grafana 3002로 전달한다. 설정 검사 실패 시 이전 Nginx 설정을 복원한다.
3. `sudo sh deploy/monitoring/install.sh`로 도메인·Secure 쿠키 설정을 적용한다. Grafana의 실제 내부 연결은 HTTP이며 TLS는 Nginx가 종료한다. 도메인 강제·Secure 쿠키를 사용하므로 기존 localhost 주소 대신 공용 HTTPS 주소로 로그인한다.
4. `sudo certbot renew --cert-name grafana.issue-atlas.kr --dry-run --run-deploy-hooks --no-random-sleep-on-renew`로 갱신 검증. 기존 `certbot.timer`와 인증서 deploy hook이 갱신 후 Nginx를 reload한다. 마지막 옵션은 수동 검증의 무작위 대기만 생략한다.

Grafana 3002·Prometheus 9090은 계속 호스트 루프백에만 바인딩한다. exporter는 호스트 포트가 없다. Nginx는 **Grafana 화면만** 외부에 제공한다. cAdvisor는 호스트 자원과 Docker·containerd 소켓에 접근하는 신뢰 구성 요소다. 소켓의 `:ro`는 API 자체의 읽기 권한 제한을 의미하지 않는다. cAdvisor·node-exporter는 서비스 네트워크에 붙지 않으며, HTTP 점검용 blackbox만 개발·운영 네트워크에 연결한다.

## 설정 변경 반영 — 별도 CD 없음

애플리케이션 변경마다 모니터링을 재배포하지 않는다. 모니터링 설정·대시보드 변경이 병합된 경우에만 서버의 신뢰할 수 있는 체크아웃에서 `sudo sh deploy/monitoring/install.sh`를 수동 실행한다. Prometheus·blackbox의 설정 파일이나 Grafana 프로비저닝 내용을 바꿨다면 다음 명령으로 변경한 서비스만 재생성한다.

```sh
cd /opt/issueatlas-monitoring
sudo docker compose up -d --force-recreate prometheus blackbox grafana
```

Nginx 설정을 바꾼 경우에만 `sudo sh deploy/monitoring/install-web.sh`를 추가 실행한다. Spring 지표 제공 코드 변경은 기존 backend CD를 따르며, 모니터링 도구의 배포와 별개다.

## 점검·복구

```sh
cd /opt/issueatlas-monitoring
sudo docker compose ps
curl -fsS http://127.0.0.1:9090/-/ready
curl -fsS http://127.0.0.1:9090/api/v1/targets
sudo docker stats --no-stream
```

Grafana에서 서버·컨테이너 그래프와 환경 선택, HTTP health, Spring 연결을 확인한다. HTTP는 HTTPS로 전환되고, 익명 `https://grafana.issue-atlas.kr/api/search`는 401이어야 한다. 로그인 쿠키의 Secure·HttpOnly 속성을 확인한다. 공개 backend 주소의 `/actuator/prometheus`도 차단되어야 한다. Spring 첫 수집 뒤 일반 API 요청을 보내 요청 지표가 생기는지 확인한다.

설정 갱신 후 `sudo docker compose up -d --force-recreate prometheus grafana`. 중단은 `sudo docker compose down`으로 하며 **`-v`를 쓰지 않는다**. 기존 애플리케이션과 DB 볼륨은 이 프로젝트가 관리하지 않는다. 서버 장애 시 같은 EC2의 모니터링도 중단되므로 외부 가용성 감시는 별도 범위다.
