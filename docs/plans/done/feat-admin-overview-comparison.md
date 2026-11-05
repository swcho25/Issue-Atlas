# feat/admin-overview-comparison — 운영 요약 및 저장된 분석 결과 비교

- Jira: S15P31C108-245

## 완료 조건
- [x] 운영 요약 API: 검수·카드 승인·CSV 처리·수집 현황의 현재 상태와 기간 내 처리 건수 구분
- [x] 분석 실행 목록 API: 지역·카드·기간 필터 및 페이지 처리
- [x] 저장된 두 실행의 조건·버전·지표 비교와 비교 불가 사유 제공
- [x] 실제 저장값만 사용하고 누락된 과거 지표는 미제공 사유 표시
- [x] API 계약·필요한 경우 새 Flyway·권한/정확성/경계 테스트 및 전체 검사 완료

## 진행
- 2026-11-04: 변경 없는 develop을 origin/develop(79e1ea2)까지 fast-forward 후 브랜치 생성. 구현 전 계획 정리만 진행.
- 기존 question·argument_run·argument_run_source 및 V0033 확인. filled_cells·previous_run_id·duration_ms가 존재하며 edit_count는 현재 저장하지 않는다. 응답 시간은 관리자 비교에서 제외한다.
- 예정 API: GET /v1/admin/overview, GET /v1/admin/argument-runs, GET /v1/admin/run-comparisons.
- 구현 순서: 저장 결과/이력의 실제 연결 확인 → 지표·응답 계약 확정 → 운영 요약 → 실행 목록·비교 → 실제 PostGIS 및 보안 테스트 → pnpm check:all.
- 비교는 동일 지역·카드·기간의 저장된 run_id 두 개를 대상으로 한다. 조건 차이·버전 차이를 표시하고 검수와의 연결 근거가 없으면 검수 효과라고 단정하지 않는다.
- 기존 filled_cells/6은 논증 칸 채움률이며 필수 근거 확보율과 구분한다. edit_count의 NULL을 0으로 치환하지 않고, 당시 정책·검수 이력이 없으면 현재 값으로 소급 계산하지 않는다.
- 구현: operations의 controller→service→repository, DTO·Swagger, contracts/operations 계약 추가. 기존 테이블의 읽기 전용 조회이므로 새 Flyway·업무 코드·수집기 변경 없음.
- 실제 PostGIS 통합 테스트 12개 통과. 기간 경계/시간대·단계별 자료 건수·승인 연계 검수 상태·저장 결과 보존·비교 조건·누락 지표·분모 0·페이지·권한·Swagger 필드 확인.
- `pnpm check:all` 전체 통과: 프론트 단위 22개·E2E 3개, 백엔드 전체 빌드·테스트, engine 566개. 로컬 Docker 연결만 프로세스 환경 변수로 지정했으며 서버·비밀 값·배포 설정은 변경하지 않음.

## 다음 할 일 / 범위 밖
- MR에서 프론트 담당 계약 리뷰. 배포 후 실제 관리자 세션으로 세 API 확인. 커밋·푸시·MR은 사용자 수행.
- 현재 edit_count 기록 및 실행↔검수 변경의 명시적 연결이 없어 수정 지표·관련 검수 변경은 미제공 사유를 반환한다. 이 연결을 새로 만드는 작업은 별도 협의 대상.
- 실행 결과 재계산·수집·모델 재분류·업무 데이터 변경·프론트 화면 구현·커밋·푸시·MR·서버 배포는 수행하지 않는다.
