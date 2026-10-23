# feat/kosis-collector — KOSIS 인구 수집·저장과 C1 출력

- Jira: S15P31C108-85 · PRD: §7.1·7.2 (C1 참조) · 묶음/단위: P1
- 기준: origin/develop dbcd94c, 2026-10-23. 범위: DT_1B26001 순이동, 성별 계, 20–24세, 여수·광주 5개 구, 연 통계.

## 완료 조건
- [x] 수집 실행마다 job_run을 기록하고 원천 행을 raw_record에 저장한다(일회용 PostGIS 검증).
- [x] C1 JSON 배열을 출력하고 기존 P2에서 held 없이 통과한다(원천 예시 3건과 CLI 검증).
- [x] 같은 원천 행은 재수집해도 중복 저장하지 않는다(첫 실행 3건, 반복 0건, 수정본 1건).
- [x] API·변환·저장 실패는 실행 실패와 안전한 원인 코드로 남는다(가짜 API 오류·실제 DB CHECK 오류 검증).
- [x] 키는 런타임 .env에서만 읽고 URL·로그·저장 자료에는 남지 않는다(모의 키 반사·HTTP 오류 검사).
- [x] engine lint/test와 실제 PostgreSQL 통합 검증을 통과한다.

## 진행
- 2026-10-23: 이슈 재사용, 진행 중 전이. 별도 feat/kosis-collector 브랜치 생성. C1·P2·V0002 계약과 KOSIS 공식 개발가이드 확인.
- 변경 전: 수집기·DB 쓰기 경로가 없음. 확인 시나리오: 실제 저장소 원천 예시 2023–2025 → -747/-719/-930, P2 pass; 재실행 raw 행 수 불변; 실패 시 raw 롤백 + failed 실행 유지.
- Docker 초기 연결 불가 → 사용자가 Docker Desktop을 켠 뒤 일회용 PostGIS로 통합 테스트 6건 통과(최종 5.24초). 실제 V0002 적용, 중간 INSERT 오류 시 raw 전체 롤백, 실패 이력 유지, 반복·수정본·기존 정책 보존·파일 출력 실패 재시도 검증.
- 2026-10-23: pnpm check:all 전체 PASS: harness, backend format, frontend lint/typecheck, 단위 9건·Chromium E2E 1건·프로덕션 빌드, backend build/test, engine lint/test 169건. 최종 코드는 별도 ruff 검사 통과. E2E_PORT=63815 사용.
- API 키를 출력하지 않는 정상 실행 경로로 실제 API export를 시도했으나 KOSIS_KEY_MISSING. 실제 KOSIS 6개 지역 응답은 아직 미검증. 6개 지역별 호출·검증 경계는 합성 응답으로 확인했다.
- 사용자 요청으로 .env.example을 루트 .env로 복사해 로컬 설정 파일 생성, gitignore 적용 확인. 에이전트는 실제 .env 내용을 읽지 않았다. KOSIS_API_KEY는 사용자가 입력해야 한다.
- 2026-10-23 09:52 KST: 사용자 키 입력 후 실제 API export 성공. 여수·광주 5개 구 × 2023–2025 = 18건, P2 CLI 18건 모두 pass. 로컬 PostGIS를 pnpm infra:up으로 기동하고 backend:dev의 Flyway로 V0001·V0002·V0004 적용 확인(수동 DDL 없음).
- 실제 DB 수집: kosis_4df868347d6d4adc94b52969f3af4656 → received=18, inserted=18, duplicates=0; kosis_917872aa765949efb47e5369fc617dd2 → received=18, inserted=0, duplicates=18. psql 재조회로 job_run 2건 모두 ok, raw_record 총 18건 확인. 최종 C1 출력도 P2 CLI 18건 모두 pass. 마이그레이션 확인용 백엔드 프로세스는 종료했고 로컬 PostGIS·볼륨은 수집 데이터와 함께 유지한다.

## 다음 할 일 / 범위 밖
- 지표 ID: 2026-10-23 사용자 위임으로 population_net_migration 지정. C1 indicators.json과 KOSIS 예시 갱신, 수집기 기본값 적용. P2·P3 리뷰 대상.
- 실제 API·로컬 DB 저장·재수집 검증 완료. 출력은 outputs/collect/kosis-c1.json(gitignore), API 키는 .env에만 유지. MR 리뷰·병합은 남아 있으며 Jira 완료 전이는 하지 않는다.
- 운영 seed·DB migration 실행·배포·스케줄링·P2/P3 변경·에어코리아(#86)는 제외.
- Notion 검색에서 해당 명세 원문을 찾지 못해 Jira와 저장소 계약을 기준으로 구현. PRD 전체 원문 대조는 미완료.
