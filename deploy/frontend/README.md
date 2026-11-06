# 프론트 EC2 배포 — S15P31C108-257

## 구성

| 브랜치 | 주소 | EC2 실행 경로 | 호스트 포트 | 연결 네트워크 |
| --- | --- | --- | --- | --- |
| develop | https://dev.issue-atlas.kr | /opt/issueatlas-dev/deploy/frontend/compose.yaml | 127.0.0.1:3100 | issueatlas-dev_default |
| main | https://issue-atlas.kr | /opt/issueatlas-prod/deploy/frontend/compose.yaml | 127.0.0.1:3101 | issueatlas-prod_default |

두 환경은 별도 Compose 프로젝트로 Next.js를 실행한다. 각 메모리 1GiB·CPU 1개·로그 제한·자동 재시작을 적용한다.
Nginx가 HTTPS를 종료하고 `/api/`를 같은 환경의 Spring(개발 8080, 운영 8081)으로 직접 전달한다.
Next 서버의 API 요청은 같은 Docker 네트워크의 `backend:8080`을 사용한다. DB 비밀번호·GMS 키는 FE에 전달하지 않는다.
Cloudflare는 DNS only로 주소만 관리하며 FE 트래픽은 Workers·Tunnel을 경유하지 않는다.

## CI/CD

1. MR 및 병합 후 변경 영역 검사: 기존 lint·타입·단위·브라우저 E2E를 유지한다. FE 검사에서 `ISSUEATLAS_EC2_BUILD=1`, `API_BASE_URL=http://backend:8080`으로 Next를 한 번 빌드한다. standalone 비밀 파일 검사도 수행한다.
2. 보호된 develop/main 병합: `frontend-image`가 같은 파이프라인의 심볼릭 링크를 보존한 frontend-standalone.tar.gz artifact와 저장소의 public을 Dockerfile.release로 포장한다. Next 재빌드·의존성 재설치는 하지 않는다. `swcho25/issueatlas-backend:frontend-<SHA>`를 게시하고 digest를 전달한다. MR에서는 이미지를 게시하지 않는다.
3. `frontend-deploy`가 기존 SSH 배포 경로로 `component=frontend`를 보낸다. 환경은 development-ec2/production-ec2이며 기존 보호 변수(`*-ec2`)를 재사용한다. Cloudflare 배포 토큰은 사용하지 않는다.
4. 배포 프로그램이 이미지 digest·소스·컴포넌트·SHA·pipeline 상한을 확인하고 FE만 교체한다. 같은 환경의 BE·수집기·engine·FE 배포는 공통 잠금과 resource group으로 직렬화한다.
5. 내부·공개 `/healthz` SHA/no-store, HTML, `/api/actuator/health`를 확인한다. 실패하면 이전 FE 이미지와 SHA로 복구하고 job은 실패로 남긴다. 첫 배포 실패는 후보를 중단하며 복구할 이전 버전이 있었다고 표시하지 않는다. 컨테이너 교체 시 짧은 중단은 있을 수 있다.

FE만 변경되면 BE·수집기는 배포하지 않는다. 계약 JSON/YAML만 바뀌면 FE 검사는 유지하되 이미지·배포는 생략한다.
수동 재배포는 GitLab New pipeline에서 보호된 develop/main과 `REDEPLOY_COMPONENT=frontend`를 선택한다. 배포 직전 브랜치 최신 SHA도 확인한다.

## 서버 준비와 전환 순서

현재 정식 도메인은 Workers이며, 코드 병합과 첫 EC2 배포 후 순차 전환한다. 커밋·push·MR은 사용자가 수행한다.

1. 기존 배포 프로그램·cicd.json을 root 전용 백업에 보관한다. 새 `deploy/ci/deploy_backend.py`를 `/usr/local/sbin/issueatlas-deploy.py`에 root:root 755로 설치하고, `compose.yaml`을 위 개발·운영 경로에 root:root 644로 설치한다. 기존 BE/DB Compose는 바꾸지 않는다.
2. cicd.json 각 환경에 `frontend_image_repository`, `frontend_project`, `frontend_host_port`, `frontend_network`, `frontend_url`을 추가한다. 값은 cicd.example.json을 따른다. 전환 전 `frontend_url`은 개발 `https://ec2-dev.issue-atlas.kr`, 운영 `https://ec2-prod.issue-atlas.kr`로 둬서 기존 Workers를 잘못 점검하지 않게 한다.
3. nginx.conf.template의 FRONTEND_HOST·NEXT_PORT·BACKEND_PORT를 각 검증 호스트와 포트로 치환한다. HTTP ACME 경로만 먼저 설치하고 기존 Certbot 계정의 webroot(`/var/www/issueatlas-acme`)로 인증서를 발급한 뒤 전체 HTTPS 설정을 적용한다. `nginx -t` 후 reload한다. 검증 호스트도 DNS only이다.
4. 이 MR을 develop에 병합하고 `frontend-image`·`frontend-deploy`를 확인한다. ec2-dev에서 세션·CSRF·화면·이미지·API와 동시 CI 자원을 점검한다. main은 develop→main MR 이후에만 운영 코드를 배포한다.
5. 환경별 첫 자동 배포가 정상이면 실제 호스트의 인증서·Nginx를 준비하고 해당 Worker의 Custom Domain 연결을 해제한 뒤 같은 호스트 A 레코드를 EC2 IP/DNS only로 연결한다. 코드·인증서·정상 후보 없이 DNS만 먼저 바꾸지 않는다. 실제 호스트를 인증서 발급에 사용할 때는 ACME 요청이 EC2로 전달되는지도 확인한다.
6. 실제 주소에서 인증·페이지·정적 파일·API·각각의 DB 연결을 검증한 뒤 cicd.json의 frontend_url을 실제 주소로 바꾼다. 개발부터 마친 다음 운영을 전환한다. backend·dev-backend 주소는 유지하며 290번에서 Nginx 직접 연결로 전환한다.
7. 두 환경의 정식 전환 이후에만 복구용 Workers를 정리한다. 초기 preview(127.0.0.1:3000)는 새 개발 FE 검증 후 이미 중단·정리했고 설정은 서버 백업에 보관했다. worker 스크립트·Wrangler·의존성은 복구 기간 동안 유지하지만 새 CI는 호출하지 않는다. 임시 검증 DNS·Nginx·인증서도 사용 종료 후 정리한다.

검증 주소가 준비되어도 **운영 Next.js가 배포됐다는 의미는 아니다**. main 첫 CI 배포와 실제 도메인 검증까지 구분해 기록한다.

## 빌드·조회·복구

저장소 루트의 비밀 파일 없는 소스 사본에서 수동 이미지 검증:

```sh
docker build -f frontend/Dockerfile -t issueatlas-frontend:local .
```

현재 EC2에는 docker0이 없어 직접 검증 빌드에만 `--network host`를 사용했다. 실행 컨테이너는 호스트 네트워크를 사용하지 않는다. CI는 별도 DinD를 사용한다.

배포 기록: 각 app_dir의 `.deploy/frontend/{current,watermark,last-result}.json`.
실제 실행 버전은 `/healthz`와 일치해야 한다. 이전 파이프라인 재시도로 watermark를 우회하지 않는다.
수동 복구 시 root 운영자가 이전 정상 digest를 선택하고 FRONTEND_IMAGE·DEPLOYMENT_REVISION·FRONTEND_PROJECT·FRONTEND_HOST_PORT·FRONTEND_NETWORK를 지정해 FE Compose만 적용한다.
기존 파일 백업과 복구 버전은 서버 전용이며 저장소에 비밀 값이나 인증서를 넣지 않는다.

현재 주소 전환 전 되돌리려면 새 FE만 중단하고 검증 호스트를 해제하면 된다. 실제 주소 전환 후에는 이전 FE 이미지 복구를 우선하고, Workers 복귀가 필요하면 Custom Domain·DNS·CI 배포 대상도 함께 되돌린다.

## 검증 범위

2026-11-05: develop f8bec0d와 배포 변경을 반영해 Linux 이미지 빌드·포장·실행, 실제 저장된 분석 결과 SSR·상세 이동·관리자 세션·CSRF·쿠키·로그아웃을 확인했다. 전체 pnpm check:all(FE 단위 42·E2E 3, BE 232, engine 587)과 별도 인프라 테스트 74건이 통과했다.
현재 PC 3회 중앙값은 HTML Workers 5.073초 / EC2 0.082초, 지역 목록 API 3.147초 / 0.084초였다. 전체 화면 완료 시간이나 부하 시험 결과를 의미하지 않는다.
실제 GitLab 첫 EC2 자동 배포·main 배포·정식 도메인 전환·복구용 Workers 정리는 사용자 MR 이후 확인한다. 외부 OpenFreeMap의 지연은 별도 과제다.
