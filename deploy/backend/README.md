# 백엔드 전용 주소 — Nginx 직접 연결 (S15P31C108-290)

| 주소 | Nginx upstream | 환경 |
| --- | --- | --- |
| https://dev-backend.issue-atlas.kr | 127.0.0.1:8080 | development |
| https://backend.issue-atlas.kr | 127.0.0.1:8081 | production |

Cloudflare는 DNS only A 레코드로 EC2 주소만 안내한다. `/v1/**`·Swagger·health 주소와 인증 방식은 유지한다. Spring·DB·9091 지표 포트는 외부에 공개하지 않는다. 프론트의 `/api/` 및 Next 내부 API 연결도 그대로다. 외부 `Forwarded`·접속 IP 헤더는 Nginx가 확정한 값으로 덮어써 기존 IP별 요청 제한을 유지한다.

## 최초 전환

1. 기존 DNS·Tunnel origin·서버 Compose·배포 설정을 백업한다. 현재 서비스를 재배포하거나 DB를 변경하지 않는다.
2. DNS-01로 `backend.issue-atlas.kr`, `dev-backend.issue-atlas.kr`의 인증서를 먼저 발급한다. 인증서 이름은 `backend.issue-atlas.kr`, 두 주소를 SAN으로 함께 사용한다. 임시 인증 TXT를 등록하되 기존 API DNS는 아직 변경하지 않는다.
3. 신뢰할 수 있는 소스에서 `sudo sh deploy/backend/install.sh development`, 검증 후 `production`을 실행한다. 문법 오류 시 기존 설정을 복원한다. DNS 전환 전에는 `curl --resolve <호스트>:443:<EC2 IP> https://<호스트>/actuator/health`로 직접 연결을 확인한다.
4. 개발 DNS부터 기존 proxied Tunnel CNAME을 EC2 IP의 A/DNS only로 바꾸고 아래 검증을 실행한다. 정상이면 운영도 전환한다. DNS 캐시에 이전 경로가 남을 수 있으므로 검증 완료까지 Tunnel을 유지한다.
5. 두 주소가 Nginx로 연결되면 인증서 갱신을 webroot로 전환한다.

```sh
sudo certbot reconfigure --cert-name backend.issue-atlas.kr \
  --webroot --webroot-path /var/www/issueatlas-acme --preferred-challenges http \
  --deploy-hook 'systemctl reload nginx' --run-deploy-hooks --non-interactive
sudo certbot renew --cert-name backend.issue-atlas.kr --dry-run \
  --run-deploy-hooks --no-random-sleep-on-renew
```

6. 새 배포 프로그램을 `/usr/local/sbin/issueatlas-deploy.py`에 root:root 755로 설치한다. 서버 `/etc/issueatlas/cicd.json`의 **두 환경** `compose_files`를 `compose.yaml`, `compose.https.yaml`, `compose.release.yaml`로 바꾼다. 다른 경로·이미지·프론트 주소·자격 증명은 유지한다. `compose.https.yaml`을 두 환경의 `deploy/dev/`에 root:root 644로 설치한다.
7. 실행 중인 배포가 없고 두 경로가 정상일 때 `issueatlas-dev-cloudflared-1`을 중단·제거한다. 기존 Tunnel Compose·routing 파일은 서버 백업으로 이동한다. DB·Spring·engine·프론트는 중단하지 않는다. 인증 TXT와 사용 종료된 Cloudflare Tunnel 설정은 검증 후 정리한다.

기본 `compose.yaml`만 실행하면 로컬 HTTP 기본값을 사용한다. 실제 배포는 HTTPS override와 현재 digest를 함께 적용한다. 이 설정 설치는 CD가 자동 수행하지 않으며, 애플리케이션 버전 배포는 기존 CI/CD를 따른다. 운영 FE 전환과 main 버전 갱신은 별도 작업이다.

## 검증

```sh
python3 deploy/dev/verify.py --base-url https://dev-backend.issue-atlas.kr --session-auth
python3 deploy/dev/verify.py --base-url https://backend.issue-atlas.kr --session-auth
```

서버에서 실행하며 해당 환경의 기존 관리자 자격 증명을 내부적으로 사용한다. 값·쿠키·토큰을 출력하지 않고 계정을 생성하지 않는다. health, 익명 401, 로그인·me·로그아웃, CSRF 없는 쓰기 403, Secure·HttpOnly·SameSite=Lax를 검사한다. 공개 지표 경로는 404이며 내부 9091 수집은 유지한다. 추가로 Swagger 로딩, HTTP→HTTPS, 개발 프론트와 기존 운영 Worker에서 API 조회, 위조 IP 헤더로 요청 제한이 우회되지 않는지 확인한다.

## 복구

문제 발생 시 서버 백업의 Nginx 설정을 우선 복원하고 `nginx -t` 후 reload한다. 2026-11-06 검증 후 기존 Tunnel 객체와 토큰을 삭제했으므로, 옛 CNAME·토큰으로는 복구할 수 없다. Tunnel 방식으로 되돌려야 한다면 새 Tunnel과 토큰을 발급하고 커넥터 연결을 확인한 뒤 새 CNAME으로 전환해야 한다. 인증서·갱신 hook도 함께 검토한다. 소스·DB 버전은 이 작업에서 변경하지 않으므로 DB 복원은 필요 없다. 토큰·개인키·실제 `.env`는 저장소에 넣지 않는다.
