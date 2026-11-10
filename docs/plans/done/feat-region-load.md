# feat/region-load — P3 기사 지역 · 시간 내보내기 · 적재 서버 명령 (MR 2/3)

- Jira: S15P31C108-195 · PRD: 7.6 · 5.4 · 묶음/단위: P3-6 · P3-7 · P3-8

## 완료 조건
- [x] `region-export`: 본문 있고 `news_event` 에 없는 기사만 JSONL 로 (같은 news_id 는 하나, 건너뛴 이유별 건수 출력)
- [x] `region-load`: 추출 결과(지역 · 요약 · 시간 · mentions) → 고치기 · 검사 · regions → `news_event` upsert. 기본 시험 실행, `--apply` 로 커밋. 기존 요약을 null 로 덮지 않고 보류 · 위반 건수를 낸다
- [x] `region-load --delete-bodies`: `good_summary` 인 기사만 `raw_record` 본문 3칸 null · `storage_scope` metadata (기사 계약 v0.3), 기본 시험 실행
- [x] 리뷰 반영(시도 이름 표 `labels` 한 곳 · `WINDOW` 출처 주석), 수집기 모드 등록 · README 실행법, `tests_postgres` 로 적재 · 지우기 확인

## 진행
- 2026-11-02: 시작. MR 1(!96, 규칙) 병합 뒤. 위치(JUSO 장소 주소 · SGIS 좌표)는 lab 코드가 약 400줄이라 MR 2b 로 나눔(정우현) — 그 전까지 새 기사는 위치 none · place_id null, 이미 있는 행의 위치는 건드리지 않는다
- 2026-11-02: 시험 실행은 한 트랜잭션에서 넣고 세어 본 뒤 되돌린다(`force_rollback`) — 적재와 본문 지우기를 같이 주면 새 요약까지 보고 지울 기사를 센다
- 2026-11-02: 수집기 모드 `region-export`(결과 파일 `articles.jsonl`, 본문이 들어 있어 600) · `region-load`(결과 파일 없음). 본문 지우기 뒤 `refine` 은 자동으로 붙이지 않는다 — 원본 지문이 그대로라 `--changed-since` 로는 안 잡혀 전체 정제를 사람이 돌린다
- 2026-11-02: `pnpm check` engine 486개 통과, `tests_postgres/test_region_store.py` 2개(일회용 PostGIS) · 수집기 실행기 테스트 통과
- 2026-11-02: MR 1 계획 파일을 `done/` 으로

## 다음 할 일 / 범위 밖
- MR 2b: 위치 — 장소 → 도로명주소(JUSO) → 좌표(SGIS), 행정 중심, 시도 대표점. 기사 읍면동은 법정동 `kr-<10>` 대신 좌표가 든 행정동 `kr-<8>`(contracts/p3 「아직 안 정한 것」, !97 리뷰). `.env.example` 에 JUSO · SGIS 키 이름, EC2 `collector.env` 에 키(사람)
- MR 3: 모델 서버(OpenAI 호환) 연결 `region-extract` — `feat-region-extract.md` (주피터는 학습용이라 쓰지 않음, 2026-11-02). 요약 프롬프트에 「본문 문장을 그대로 옮기지 말 것」 보강 — 지금 47건이 본문을 옮김. 지역 질의 재질문 덧붙임에 places 개수 제한도(「places 5개 · mentions 8개까지」) — 시도지사 일정 모음 기사(04100078.20251202064952001)가 places 를 늘어놓다 max_tokens 500 에서 잘려 「JSON 아님」이 났다(2026-11-02 이 덧붙임으로 다시 돌려 적재)
- 서버 실행: 시험 실행 → 본문 지우기(약 3,435건) → `refine` → 본문을 옮긴 요약 다시 요약 → 지우기
