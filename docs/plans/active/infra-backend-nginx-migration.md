# infra/backend-nginx-migration — 백엔드 전용 주소의 Nginx 전환

- Jira: S15P31C108-290

## 완료 조건
- [x] 기존 개발·운영 API 주소와 경로를 유지한 HTTPS Nginx 구성 제공
- [x] 인증서 선발급 후 개발 → 운영 DNS only 전환과 health·Swagger·CSRF·인증 회귀 확인
- [x] 개발·운영 CD 구성에서 Tunnel 의존 제거, 실행 중 Tunnel 중단
- [x] 배포 도구 테스트·전체 검사 및 운영 안내 반영

## 진행
- 2026-11-06: 최신 origin/develop에서 브랜치 생성. 개발 8080·운영 8081의 루프백 Spring 및 기존 Tunnel 확인.
- 두 API DNS를 EC2 A/DNS only로 전환. HTTPS 인증·CSRF·쿠키·Swagger 및 공개 지표 차단 확인. 프록시 헤더 위조로 요청 제한이 우회되지 않음을 확인.
- 인증서 webroot 갱신 시험 통과. 두 환경의 서버 배포 설정·HTTPS override·배포 프로그램 설치 완료. 애플리케이션과 DB 버전은 변경하지 않음.
- 사용자 승인 후 사용 종료 Tunnel 객체·컨테이너·서버 토큰·임시 인증 TXT 2개 제거. 제거 후 두 API의 관리자 로그인·로그아웃 회귀 재통과.
- `pnpm check:all` 통과. 서버 설정 백업: `/var/backups/issueatlas-backend-290-20261106T063501Z`, `/var/backups/issueatlas-backend-290-final-20261106T064309Z`.

## 다음 할 일 / 범위 밖
- 운영 애플리케이션 main 배포·DB Backfill·운영 프론트 전환은 다음 주 별도 작업. 이번에는 접속 경로만 변경.
- 커밋·push·MR은 사용자 진행.
