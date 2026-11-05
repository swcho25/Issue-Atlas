# infra/frontend-ec2-deployment — Next.js EC2 전환

- Jira: S15P31C108-257

## 완료 조건
- [x] 개발·운영별 Next.js Compose, 이미지·배포·복구 로직 및 변경 영역 조건 구현.
- [x] Linux standalone 빌드와 동일 결과물 이미지 포장·실행, 별도 개발 HTTPS·인증 확인.
- [x] 최신 develop 포함 전체 검사·인프라 검사 통과.
- [ ] 사용자 MR 후 GitLab 첫 FE 이미지·배포, CI 병렬 실행 중 자원 확인.
- [ ] 개발부터 운영 순으로 정식 도메인 전환·검증 후 기존 Workers·preview 정리.

## 진행
- 2026-11-05: origin/develop 2e11a74 기준 시작. EC2 4 CPU·메모리 15.4GiB·디스크 여유 263GB 확인.
- 2026-11-05: ec2-dev.issue-atlas.kr DNS only·Let's Encrypt·Nginx 구성. 초기 검증 FE(3000)에서 브라우저·관리자 세션·CSRF·쿠키·로그아웃 통과. 업무 데이터 생성 없음.
- 2026-11-05: 현재 PC 3회 중앙값 HTML Workers 5.073초 / EC2 0.082초, 지역 API 3.147초 / 0.084초. 전체 화면 완료 시간·병렬 부하 측정은 아님.
- 2026-11-05: FE CI를 검사 단계 standalone 빌드 → 같은 artifact 이미지 포장 → 기존 SSH 배포 방식으로 변경. 환경별 FE 기록·이전 이미지/버전 복구와 인프라 테스트 72건 통과.
- 2026-11-05: 서버 배포 프로그램·cicd.json을 /var/backups/issueatlas-frontend-257-20261105에 백업. 새 FE 핸들러와 개발/운영 Compose 설치. 개발 FE 3100 실행·배포 프로그램 내부/HTTPS 점검 통과. 운영은 3101 실행 구성과 ec2-prod HTTPS만 준비, main 배포 전이므로 FE 미실행.
- 2026-11-05: 최초 전체 pnpm check:all 통과(FE 단위 40·E2E 3, engine 587). 작업 중 추가 병합을 발견해 변경을 보존하고 f8bec0d로 fast-forward. 최신 지도·결과 화면을 포함해 전체 검사(FE 42·E2E 3·BE 232·engine 587)와 Linux standalone/포장 이미지 재검증 통과. 인프라 테스트 74건 및 해석된 CI 셸 문법 통과.

- 서버 현황: ec2-dev는 3100의 f8bec0d 후보이며 실제 저장된 분석 결과 SSR·상세 이동·인증 통과. 초기 3000 컨테이너/태그와 임시 빌드 소스 정리. 운영 FE 미실행이며 ec2-prod HTTPS는 첫 main 배포까지 502가 예상됨. 정식 두 주소는 기존 Workers 유지.

## 다음 할 일 / 범위 밖
- 서버 frontend_url은 첫 CD 검증을 위해 ec2-dev/ec2-prod 임시 주소로 설정. 정식 DNS는 아직 Workers. 첫 CD 후 Custom Domain 해제·실제 주소 인증서/NGINX·DNS only 전환과 frontend_url 갱신을 함께 수행한다.
- main은 develop→main MR 이후에만 해당 코드로 FE를 배포한다. 사용자 커밋·push·MR 전에는 실제 CD 성공이나 운영 이전 완료로 처리하지 않는다.
- 현재 CI 작업이 없어 병렬 부하 검증은 첫 MR 때 확인. backend/dev-backend Tunnel은 팀 사용 여부 확인 전 유지한다.
- OpenFreeMap 외부 타일 지연은 별도 과제. 데이터·수집기·백엔드 업무 기능은 수정하지 않는다.
