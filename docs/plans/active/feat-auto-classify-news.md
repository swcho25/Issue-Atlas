# feat/auto-classify-news — 요약 적재 뒤 기존 F4 기사 분류 연결

- Jira: S15P31C108-348 · PRD: P4 · 묶음/단위: P4 기사 분류

## 완료 조건
- [x] `region-load --extract --apply`가 요약을 실제 저장한 경우에만 자동 분류를 시작한다.
- [x] `classify`가 새 기사 임베딩 건수를 API 없이 확인하고 상한 이내에서 세 단계를 순서대로 실행한다.
- [x] 실패 시 후속 단계를 멈추고 실행 로그·단계별 결과·종료 코드를 남기며 재실행 시 임베딩을 재사용한다.
- [x] 조건별·중간 실패 테스트와 변경 영역의 직접 lint·포맷·테스트 검사가 통과한다.
- [ ] 개발 환경에서 이번 변경으로 분류한 기사 1건의 DB F4 확률·선택 → API → 브라우저 연결을 확인한다.

## 진행
- 2026-11-16: 기존 분류 입력, 요약 적재, 본문 삭제·재정제 순서를 확인하고 작업 시작.
- 2026-11-16: `region-load` 커밋 뒤 요약 적재 건수로 자동 실행을 결정. 신규 임베딩 100건을 기본 상한으로 선택하고, 초과하면 코드 3으로 중단. 단위 검사 32개와 변경 파일 lint·포맷 통과.
- 2026-11-16: `pnpm check`는 Windows pnpm 저장소 심볼릭 링크 권한 오류로 시작 실패. engine 전체 lint·포맷은 직접 통과. engine 전체 pytest는 변경과 무관한 `test_api_health.py::test_health_returns_ok`에서 멈춰 중단. Docker API 접근 거부로 이미지 빌드·DB 검증 불가.
- 2026-11-16: 권한을 높여 `pnpm check` 재실행 완료 — engine lint·포맷 통과, pytest 671개 통과. Docker 접근은 가능하지만 실행 중인 로컬 DB 컨테이너는 없음.
- 2026-11-16: 개발 사이트에서 기사 `01620001.20240130200759001`가 결과 API `articles[]`와 브라우저 지도 상세에 동일한 요약·근거 ID로 표시됨을 확인. 이는 기존 배포본이며 이번 변경 코드의 DB 저장 검증은 아님.
- 2026-11-16: DataGrip의 `IssueAtlas DEV` 연결에서 같은 기사의 활성 문서 임베딩과 F4 점수 2건을 읽기 전용으로 확인. `A3`는 확률 `0.9122`·`selected=true`, `C1`은 `0.0871`·`selected=false`이며 `observation.tags={A3}`. API·브라우저의 기사 ID 및 근거 ID `ev_news_b3d9bfc8e3a211ef2d9e24d312d088c1`와 연결됨. 이는 기존 배포본의 데이터 흐름 검증이며 이번 자동 호출의 서버 실행 검증은 아님.

## 다음 할 일 / 범위 밖
- 현재 코드와 계획 파일은 커밋하지 않은 상태다. 기존 미추적 `outputs/`는 이 작업에 포함하지 않는다.
- 개발 수집 서버에 새 이미지·`deploy/collector/run_collector.py`를 배포한 뒤, `sudo issueatlas-collect count-docs`의 신규 건수를 확인한다. 100건 이하에서 요약된 기사 1건을 `region-load --extract ... --apply`로 적재하거나 `sudo issueatlas-collect classify`를 실행한다.
- 새 코드 배포 뒤 요약 적재로 자동 호출된 기사 ID의 DB·API·화면 결과를 대조한다. 기존 배포본의 기사 연결은 DataGrip·API·브라우저에서 확인했고, 새 자동 호출은 아직 서버에서 실행하지 않았다.
- 엔진 이미지 빌드는 아직 실행하지 않았다. 서버 배포 전 새 이미지가 수집기에 `count-docs`를 포함하는지 확인한다.
- 기사 수집·P3 추출 자동화, F4 재학습·교체, 관리자 화면은 범위 밖.
