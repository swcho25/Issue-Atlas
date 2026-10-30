# feat/airkorea-collector — 에어코리아 측정소·최종확정 자료 수집

- Jira: S15P31C108-86 · PRD: C1 §7.1 참조 · P1
- 기준: feat/kosis-collector 10c9ab7. KOSIS 공통 저장 코드에 의존하는 후속 브랜치이며 KOSIS 먼저 병합 후 develop 대상 MR로 올린다.

## 완료 조건
- [x] 측정소 API 페이지를 모두 수집하고 여수·광주만 필터링하여 [경도, 위도] C1 메타를 출력한다(원천 예시·모의 API 검증).
- [x] 최종확정 XLSX를 스트리밍으로 읽어 대상 지역·기간의 6개 지표를 출력하며 24시·빈칸을 C1 규칙으로 처리한다.
- [x] 모든 출력은 기존 P2 정제에서 held 없이 통과한다(원천 예시·실제 XLSX 3,168건).
- [x] 실행 이력·원천 payload·해시를 DB에 저장하고 재수집 중복과 실패 롤백을 검증한다.
- [x] 키는 런타임 .env에서만 읽으며 요청 URL·예외·로그에 노출하지 않는다(모의 키·HTTP 오류·Encoding 키 검증).
- [x] 변경 영역·전체 검사와 일회용 PostGIS 테스트를 통과하고 실제 엑셀 결과를 남긴다. 실제 API 검증은 사용자 요청으로 후속 분리.

## 진행
- 2026-10-23: Jira #86 진행 중 전이. API 공식 문서에서 KOGL-3·좌표·페이지 규칙 확인. Downloads의 실제 2024년 XLSX(413,035,533 bytes, 월별 12시트) 발견, 헤더 확인. 첫 실제 검증은 2024-01-01 하루로 제한한다.
- .env를 읽지 않고 AIRKOREA_SERVICE_KEY 빈 입력 항목 추가. 실제 키는 사용자 입력 대기.
- 사용자가 "키는 나중에"로 지정. 실제 측정소 API 호출은 수행하지 않고 구현·원천 예시·모의 응답 검사로 범위를 제한한다.
- 2026-10-23: 실제 XLSX 2024년 1월 시트 486,433행 스트리밍, 2024-01-01 원천 일자의 여수·광주 22개 측정소 × 24시간 × 6개 항목 = 3,168건. 결측 23건, 24시 항목 132건. P2 CLI 3,168건 모두 pass.
- 실제 로컬 DB: airkorea_11b6f3b22b3a4f51a8f444f17a41a201 → received=3168, inserted=3168; airkorea_467e8afee7ce4e2fb3a29e76c4c20f5e → received=3168, inserted=0, duplicates=3168. SQL 재조회로 두 실행 모두 ok·airkorea_final raw 총 3,168건 확인. 기존 KOSIS 데이터 유지.
- pnpm check 통과: engine lint + 203 tests. uv --directory engine run pytest tests_postgres: KOSIS 6건 + 에어코리아 4건, 총 10 passed(9.03s). V0002 실제 file_name 저장·출처별 spec·배치 롤백·API 키 누락 실패 기록 검증.
- E2E_PORT=63816 pnpm check:all 전체 PASS: harness, Java 포맷, frontend lint/typecheck·9 tests·Chromium E2E 1건·프로덕션 빌드, backend build, engine lint·203 tests. backend Gradle 9개 task는 UP-TO-DATE로 기존 성공 결과를 재사용했다.
- source_id 2개와 지표 ID 6개를 C1 목록에 추가. C1 JSON Schema·DB 스키마·P2 로직은 변경하지 않음. shared PostgresStore를 source/license/version/method와 file_name을 받도록 확장했고 KOSIS 회귀 검증 통과.

## 다음 할 일 / 범위 밖
- 스케줄링, P2/P3 로직 변경, 공통 place_id 매핑, 운영 배포 제외.
- 측정소명 연결이 없거나 여러 개면 좌표를 추측하지 않고 geometry=null로 보존한다.
- AIRKOREA_SERVICE_KEY 입력 후 실제 측정소 API 페이지 수·좌표·범위 검증과 저장 재실행 필요(사용자가 후속으로 미룸). API 성공·최신 측정소 수는 아직 주장하지 않는다.
- C1 source/indicator 목록은 P2·P3 리뷰 필요. KOSIS 선행 브랜치 병합 후 develop 대상으로 MR 생성, push는 사람이 수행한다. Jira는 병합 전 진행 중 유지.
