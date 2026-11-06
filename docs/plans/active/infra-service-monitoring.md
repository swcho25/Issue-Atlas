# infra/service-monitoring — 서버·컨테이너·Spring 지표 조회

- Jira: S15P31C108-273

## 완료 조건
- [x] Prometheus·Grafana·호스트/컨테이너 exporter 구성과 대시보드 제공
- [x] 지표 포트는 공개하지 않고 Grafana는 SSH·로그인으로 접근
- [x] Spring의 기존 health·인증 동작 유지 및 지표 포트 격리 검증
- [x] 개발·운영 구분, 미배포 운영 FE 표시, 보존 기간·자원 제한 적용
- [x] 서버 설치와 저장소 전체 검사 결과 기록
- [x] 팀 공용 Grafana 도메인·HTTPS·로그인 접근 검증

## 진행
- 2026-11-05: origin/develop에서 브랜치 생성. 가용 메모리 약 13GiB, 디스크 여유 255GiB 확인. 알림은 범위에서 제외.
- 2026-11-05: EC2 `/opt/issueatlas-monitoring`에 5개 컨테이너 설치. 지표 실제 수집·대시보드 20개 조회식 검사, 익명 Grafana 401·공개 backend 지표 401·루프백 포트 확인. 개발·운영 compose는 기존 파일 백업 후 환경 설정 두 줄만 준비(서비스 재시작 없음).
- 2026-11-05: `pnpm check:all` 전체 통과. 배포 도구 테스트 76개 통과. 실제 PostGIS 통합 테스트에서 health 유지·지표 포트 전용 접근·전달 헤더 우회 차단 확인.
- 2026-11-06: 약 16시간 실행 후 정상 수집 유지, 모니터링 메모리 합계 약 300MiB 확인. 로그인된 브라우저에서 대시보드와 production 환경 전환 확인.
- 2026-11-06: 사용자 요청으로 공용 `grafana.issue-atlas.kr` 접속 추가. 별도 CD는 만들지 않고 구성 변경 시 수동 반영. 팀원 계정은 Viewer로 운영자가 개별 생성.
- 2026-11-06: DNS only A→EC2, Nginx HTTPS·Live WebSocket 전달, 도메인 강제·Secure 쿠키 적용. 공용 주소의 관리자 로그인·대시보드 표시, HTTP→HTTPS 301, 익명 search/datasources 401, 내부 포트 유지 확인. 인증서 갱신 모의 검사와 배포 도구 테스트 77개 통과.

## 다음 할 일 / 범위 밖
- 커밋·push·MR은 사용자 진행. Spring 지표의 실제 수집은 해당 환경 backend CD 후 확인.
- 운영 FE 이전·로그 수집·알림·DB 쿼리별 분석은 이번 범위 제외.
