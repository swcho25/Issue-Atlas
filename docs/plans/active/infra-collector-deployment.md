# infra/collector-deployment — 수집기 EC2 배포와 자동 버전 갱신

- Jira: S15P31C108-105
- 기준: origin/develop 5886c2b. develop/main 병합 후 이미지만 자동 갱신하고, 실제 수집은 운영자가 수동 실행한다.

## 완료 조건

- [x] 잠금 의존성과 계약 파일을 포함한 비밀 없는 수집기 이미지를 빌드하고 오프라인 실행을 검증한다.
- [x] EC2에서 기존 DB에 연결하는 수동 실행 설정, 로그·입력·결과 보관과 동시 실행 방지를 마련한다.
- [ ] 보호된 브랜치의 CI 성공 후 digest로 수집기 버전을 갱신하며 실제 API 호출·DB 쓰기는 실행하지 않는다.
- [x] 준비된 키·입력 자료 범위에서 실제 수집·재실행을 검증하고 미검증 항목을 명시한다.
- [ ] 운영 방법과 MR/CD 결과를 기록한다. push·병합은 사용자 수행이다.

## 진행

- 2026-10-26: 사용자 이슈 105와 브랜치 생성·구현 승인. 깨끗한 develop에서 fetch 후 infra/collector-deployment 생성. Jira 연결 도구는 없어 이슈 번호만 기록했다.
- 사용자가 지정한 Downloads/env의 API 키 두 개만 런타임에 서버의 보호된 collector.env에 연결했다. 값은 출력하지 않았으며 이미지·저장소·CI 변수에 넣지 않았다. 비공개 저장소 1개를 쓰는 기본안으로 기존 Docker Hub 저장소에 collector-커밋 태그를 사용하고 component label로 구분한다.
- 최신 기준에는 이슈 102의 P1 입구 검사 수정과 c1_record 저장이 반영되어 있다. 기존 코드의 해당 기능을 변경하지 않고 배포했다.
- Python 3.13 고정 이미지·uv.lock·계약 파일 포함, UID 10001·읽기 전용 FS, CPU/메모리/PID 제한 구성. 로컬 빌드·오프라인 예제·비밀 파일 미포함 검사 PASS. EC2 Compose/키 마운트/DB SELECT 1과 동시 실행 잠금 검사 PASS.
- collector-image/collector-deploy 구현. backend-deploy/Flyway 성공 후 사용 digest를 원자 갱신하며 실제 수집은 하지 않는다. 이전 버전 유지·혼동된 component 거절·오래된 pipeline 차단·수동 실행 버전 선택 등을 포함한 배포 테스트 24건 및 lint/format PASS. pnpm check PASS(엔진 232건, 프론트 9건 포함). pnpm이 생성한 도구 메타정보만 원복했다.
- 실제 수집 중 CI/서비스 Docker의 공통 iptables 체인 처리로 서비스 bridge 외부 통신이 누락된 것을 확인했다. 서비스 subnet의 외부 접속·응답만 DOCKER-USER에 복구하고 CI Docker ExecStartPost에 등록했다. 반복 적용의 중복 방지와 CI Docker/Runner 재시작 후 외부 통신·Runner 인증 유지 검증 PASS. 서비스 Docker는 재시작하지 않았다.
- EC2 검증 이미지로 KOSIS 여수 2023~2025 3건 저장, 재실행 inserted=0/duplicates=3. 에어코리아 측정소 22건 저장, 재실행 inserted=0/duplicates=22. 모두 C1 장부 존재 확인.
- 사용자가 제공한 공공데이터포털 최종확정 XLSX(413,035,533바이트)는 12개월 시트·12개 열 모두 기존 수집기 입력과 일치했다. 앞서 받은 별도 월별 파일은 Data 시트·짧은 열 이름으로 형식이 달랐다. 수집 코드는 변경하지 않았다. 원본을 EC2 input/final-2024.xlsx에 보관하고 2024-01-01 하루를 검증: airkorea_415f0ac9415848fa9904cb539db6782a received=3168/inserted=3168, 재실행 airkorea_3ae2bd61acfa4d99a220442b7c1004db inserted=0/duplicates=3168. 각각 약 41초/39초, 기존 제한 내 정상 종료했다.
- 사용자 승인에 따라 위 API·XLSX 검증 실행 ID 7개만 대상으로 raw_record 3,193건, job_run 7건, 검증 전용 KOSIS spec 1건을 삭제했다. 정제 참조 0건·예상 삭제 건수·다른 원본/실행 ID 보존을 트랜잭션으로 검사했다. 검증 C1 출력 폴더 7개도 경로·내용을 확인 후 정리했다. 공통 source/spec 정의·입력 원본·검증 요약/로그는 유지하며 정리 결과는 서버 xlsx-105-verification/cleanup.json에 기록했다.
- 기존 Spring/PostGIS/Tunnel 정상·HTTPS health 200 UP. 현재 수집 검증은 로컬 빌드 검증 이미지를 서버에 전달해 수행했다. 정식 current.json 사용 버전은 첫 collector CD가 성공할 때 생성된다.
- 최종 pnpm check:all 전체 PASS: harness, backend format/build(테스트 포함), frontend lint/typecheck/unit 9건/e2e 1건, engine lint/pytest 232건. 별도 배포 테스트 24건 PASS. 수집·변환 코드 변경 없음. 로컬·EC2의 임시 issueatlas-collector:105-check 이미지를 삭제했다. pnpm이 생성한 실행 도구 메타정보만 원복하고 의존성 잠금은 유지한다.

## 다음 할 일 / 범위 밖

- cron·RabbitMQ·FastAPI 상시 서비스·프론트 배포는 제외한다.
- P1 수집 규칙·C1 장부·P2 계약·정제 로직을 이 인프라 작업에서 변경하지 않는다.
- 사용자 push·MR CI·develop/main의 첫 collector CD 검증이 남아 있다. 커밋·push는 아직 수행하지 않았다.
