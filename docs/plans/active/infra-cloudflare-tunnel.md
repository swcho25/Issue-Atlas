# Cloudflare Tunnel 기반 백엔드 HTTPS 연결

- Jira: 사용자가 별도 관리. 기존 infra/ec2-dev-services 작업 트리에서 후속 구성 준비.

## 완료 조건

- [x] 고정 버전·digest의 cloudflared와 HTTPS용 Compose 추가 구성을 작성한다.
- [x] Cloudflare에 issueatlas-backend Tunnel을 생성하고 토큰을 서버 전용 파일로 저장한다.
- [x] backend.issue-atlas.kr을 http://backend:8080으로 연결한다.
- [x] HTTPS health·인증·CSRF·Secure 쿠키·Swagger 접근을 검증한다.

## 진행

- 2026-10-23: 사용자가 Tunnel 방식으로 확정. 현재 Spring·DB healthy 확인. 공식 이미지 2026.10.3 digest 확인 및 EC2 다운로드 완료.
- 2026-10-23: compose.tunnel.yaml 준비. 토큰 값은 환경변수·명령줄 대신 서버 파일을 읽도록 구성. 추가 구성을 적용할 때만 Secure 쿠키와 forwarded headers 처리가 활성화된다.
- 2026-10-23: Cloudflare 계정 로그인 완료, Tunnel 생성 양식에 issueatlas-backend 입력. 실제 생성·외부 공개 전 사용자 확인 대기.
- 2026-10-23: 사용자가 정책 확인 후 생성·연결 승인. Tunnel 685285ca-301a-478c-b6bd-59eccbf41ad7 생성, 서버 연결 Healthy, published application 및 proxied CNAME 자동 생성 확인.
- 2026-10-23: 토큰 전달 첫 시도에서 형식 오류로 연결 실패. 원본을 비공개로 재검증하고 파일 전송 방식으로 복구. 임시 로컬·서버 전송 사본 삭제, 최종 토큰 파일 0400·UID/GID 65532 유지.
- 2026-10-23: 실제 HTTPS health UP·미인증 401·CSRF 없는 로그인 403·ADMIN 로그인/me·Secure/HttpOnly/SameSite=Lax·로그아웃 검증 PASS. 테스트 계정 생성 없음. 기본 urllib 클라이언트의 Cloudflare 403은 점검용 User-Agent 명시 후 해소, Cloudflare 보안 기능 비활성화 없음.
- 2026-10-23: Cloudflare Always Use HTTPS 활성화(영역 전체), HTTP→HTTPS 301 확인. Swagger 브라우저 로딩 및 generated server URL HTTPS 확인. 응답 no-store·캐시 HIT 없음 확인.

## 다음 할 일 / 범위 밖

- 서버 파일 /etc/issueatlas/cloudflared-token은 UID 65532가 읽을 수 있도록 소유권·권한 제한. 토큰 내용은 출력·커밋하지 않는다.
- public route는 Spring의 기존 공개 health·Swagger와 인증 API에 접근 가능하게 한다. 기존 Spring 인증·ADMIN·CSRF 정책은 유지한다.
- Cloudflare 정책: 공식 Tunnel 생성·토큰 관리·token-file 지침 확인. 기존 Spring ADMIN·CSRF·인증 규칙 유지, 공개 Swagger·health는 사용자 승인 범위다.
- 앞으로 서버 갱신에는 compose.yaml과 compose.tunnel.yaml을 함께 사용한다. 프론트 로그인 UI 및 Swagger 인증된 쓰기 호출 검증은 이번 범위에 포함하지 않았다.
- 프론트 배포·CI/CD·DB 스키마 변경은 범위 밖이다.
