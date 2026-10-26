# infra/ec2-dev-services — EC2 PostGIS·Spring 개발 실행 환경

- Jira: 도구 미연결, 사용자가 별도 관리 · 묶음/단위: P7 서버 공통

## 완료 조건

- [x] 서버용 Compose·Dockerfile과 비밀값 없는 환경변수 예시를 작성한다.
- [x] EC2에서 PostGIS·Spring, Flyway V0001·V0002·V0004와 health를 확인한다.
- [x] CSRF·관리자 로그인·인증 실패·VIEWER 접근 제한을 실제 HTTP로 확인한다.
- [x] DB 컨테이너 재생성 후 보존·마이그레이션 재실행·API 정상 응답을 확인한다.
- [x] 접속은 loopback/SSH 터널로 제한하고 실행·검증·남은 사항을 기록한다.

## 진행

- 2026-10-22: 사용자 요청으로 시작. 로컬 develop이 clean인 것을 확인하고 infra/ec2-dev-services 생성. Jira 도구 미연결. 기존 EC2 서비스·볼륨 없음 확인.
- 인증·DB 마이그레이션 코드는 수정하지 않는다. 서버에서 생성하는 비밀정보는 출력·커밋하지 않는다.
- 2026-10-22: /opt/issueatlas-dev에 배포. Java 21 digest 고정 이미지로 bootJar 성공. PostGIS·Spring 모두 healthy. 비밀값은 서버에서만 생성하고 .env 권한 0600 적용.
- 2026-10-22: PostgreSQL 17.11 / PostGIS 3.5.7, Flyway 0001·0002·0004 성공. 실제 HTTP에서 health UP·미인증 me 401·CSRF 없는 쓰기 403·ADMIN 로그인/me·VIEWER 관리자 API 403·로그아웃 확인. 합성 VIEWER 한 건은 비활성화 후 보존.
- 2026-10-22: DB·Spring force-recreate 후 app_user 데이터 지문 동일, Flyway 성공 이력 3건 유지·up to date 로그, health 재확인. DB 볼륨 삭제 없음.
- 2026-10-22: 포트 5432·8080은 127.0.0.1에만 바인딩. UFW SSH 22 규칙 유지. 운영 안내·검증 스크립트 작성. git diff --check 확인. 사용자 최종 점검 대기.
- 2026-10-22: 사용자 최종 점검 PASS 전달받음. 이후 사용자 요청으로 비활성 합성 VIEWER(id=2, 정확한 이메일·역할·비활성 조건 확인) 1건과 hello-world·alpine 테스트 이미지를 삭제. 테스트 계정 0건·활성 ADMIN 1건, 두 서비스 healthy·health/401 재검증 PASS. 실제 서비스 이미지·DB 볼륨은 유지.

## 다음 할 일 / 범위 밖

- 도메인·Cloudflare·HTTPS·Next.js·RabbitMQ·정기 수집은 별도 작업.
- 재부팅 및 전체 기존 자동화 테스트는 이번 실제 환경 smoke 검증과 구분한다.
- 기존 Java 테스트 전체와 프론트/브라우저 연동은 실행하지 않았다. bootJar 및 실제 EC2 smoke 검증만 통과했다.
- 사용자 최종 점검 및 팀 리뷰·커밋·MR·Jira 기록이 남아 있다. push·병합은 수행하지 않았다.
