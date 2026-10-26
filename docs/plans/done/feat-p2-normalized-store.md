# feat/p2-normalized-store — 정제 결과 저장 테이블(normalized) 추가

- Jira: S15P31C108-99 (에픽 S15P31C108-50) · PRD: 7.1 · 7.5 · 10장 재현성 · 회사 기술 명세 D-19 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] Flyway V0005 로 raw_record 에 장부 칸(`c1_record`, C1 레코드 jsonb, P1 이 채움)을 더하고 normalized_record 테이블·normalized_ready 뷰를 만든다. normalized_record 칸은 정제 결과 레코드(jsonb), P3 가 읽는 C1 칸, P2 칸 5개, 처리 상태·사유·rule_version·정제 시각(D-19). content_hash 는 UNIQUE 이고 raw_record 를 가리킨다
- [x] `python -m pipeline.refine --db` 가 raw_record 의 장부(`c1_record`)를 읽어 정제하고 normalized_record 에 저장한다. P2 는 장부를 만들지 않는다. 장부가 없는 원본은 건너뛰고 source_id 별로 세며, 장부의 content_hash 가 원본과 다르면 아무것도 저장하지 않고 멈춘다
- [x] 같은 장부로 명령을 두 번 돌려도 행 수와 저장 결과가 바뀌지 않는다(같은 rule_version). P1 덤프(collect-data-20261023, 장부 칸 없음)로 돌린 결과와, 장부를 채운 상황을 흉내 낸 결과를 「진행」에 남긴다
- [x] tests_postgres 에서 여수 KOSIS 예시가 수집 → raw_record + 장부 → normalized_record → 「pass·fixed 이고 is_latest」 조회까지 1건으로 이어진다
- [x] contracts/p2 에 테이블 칸과 다음 단계가 읽는 조건을 적고(v0.2), contracts/database 에 장부 칸을 적고, pnpm check:all 이 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-26: 시작. 기준 `origin/develop`(c122c78). -89(`feat/p2-intake-validate`)는 아직 미병합이라 이 브랜치에는 P2 계약 v0.1.2 문구가 없다. `contracts/p2/README.md` 변경 이력 표에서 충돌이 날 수 있으니 먼저 병합되는 쪽에 맞춘다
- 2026-10-26: 배경 — DB 에는 `raw_record.payload`(원천 행)만 남고 C1 레코드는 수집기 JSONL 에만 있어, P3·P4 가 읽을 곳이 없고 P2 규칙을 바꾸면 수집기를 다시 돌려야 한다. 회사 노션(3레인 v1)은 이 단계를 「normalized → evidence 승격」, 기술 명세 D-19 는 「레코드별 처리 상태와 판정 사유」로 적는다
- 2026-10-26: 결정 — 수집기(`pipeline/collect/`, 담당 장성우)는 바꾸지 않는다. 정제 저장은 C1 JSONL 을 받아 넣는 P2 명령으로 하고, 수집기가 직접 부르게 하는 것은 MR 본문 요청으로 남긴다. 마이그레이션은 V0005 (develop 에 V0003 이 없음)
- 2026-10-26: 환경 — 개발 PC 에 Java 가 없고 Docker 가 꺼져 있음. backend 검사(포맷·Testcontainers)와 tests_postgres 에 둘 다 필요하다. 박준우가 JDK 21 설치·Docker 실행 예정
- 2026-10-26: P1 담당이 수집 데이터 덤프 `collect-data-20261023.sql`(데이터만, source 2 · source_spec 2 · job_run 4 · raw_record 3,186)를 공유. 팀이 나눠 갖는 것은 raw_record 이고 수집기 JSONL 은 공유되지 않는다
- 2026-10-26: 확인(저장소 밖 스크립트, DB 없이 덤프 파일만 읽음) — raw_record 3,186건을 수집기 변환 함수로 C1 레코드로 다시 만듦: KOSIS 18 · 에어코리아 3,168, content_hash 3,186건 모두 일치. 지금 P2 정제 결과 3,186건 모두 pass(사유 0), is_latest 모두 true, not_published 23. 여수 20–24세 순이동 2023 -747 · 2024 -719 · 2025 -930
- 2026-10-26: **결정(박준우)** — 완료 조건 2·3번을 「C1 JSONL 넣기」에서 「raw_record 에서 C1 을 다시 만들어 정제·저장」으로 바꿈. 다시 정제할 때도 raw_record 에서 다시 만들므로 입력 원본 jsonb 칸 대신 정제 결과 jsonb 를 둔다(1번도 맞춰 고침). Jira -99 설명도 같이 고침
- 2026-10-26: 이 방식의 한계(계약 v0.2 에 적을 것) — ① 에어코리아 원본에 엑셀 행 번호가 없어 다시 만든 `locator.row` 가 비어 있음(시트·측정소코드·측정일시·항목으로 칸은 찾을 수 있음) ② raw_record 는 처음 저장한 실행에만 남으므로 `run_id` 는 「처음 저장한 실행」이 됨(지금 계약 문구는 「마지막으로 확인한 실행」)

- 2026-10-26: 구현 시작. Docker 29.6.2 확인. Java 는 아직 안 보임 — `java` 명령·`JAVA_HOME` 없음, 설치 폴더에 JDK 21 없음, IntelliJ 내장 JBR(Java 25)만 있음. backend 는 toolchain 21 고정이고 자동 내려받기(foojay) 설정이 없어 JDK 21 이 있어야 backend 검사가 돈다
- 2026-10-26: TDD — `tests/test_refine_rebuild.py`(단위 9) · `tests_postgres/test_refine_store.py`(PostGIS 5) 를 먼저 쓰고 모듈이 없어 실패하는 것을 확인. 명세 검사 테스트 하나가 구현 뒤에도 실패해서 보니 테스트 전제가 틀렸고(시작 연도 2024 는 수집기가 쓸 수 있는 명세) 진짜 빈틈도 있었다: 한 행씩 좁혀 다시 만들면 명세 기간 밖 원본도 통과. 테스트를 고치고 `REBUILD_ROW_OUTSIDE_SPEC` 테스트를 먼저 추가해 실패 확인 뒤 고침
- 2026-10-26: **결정** — UNIQUE 를 dedup_key 가 아니라 content_hash 로 둠. 같은 dedup_key 에 원본이 다르면(충돌) 둘 다 held 로 저장해야 하는데 dedup_key UNIQUE 로는 둘 중 하나가 덮인다. raw 도 content_hash 로 이미 반복을 막으므로 raw 한 행 = 정제 한 행이 된다. 완료 조건 1번 문구도 고침
- 2026-10-26: **결정** — KOSIS 는 `to_records` 가 실행 하나의 행이 다 모여야 통과해서(재수집 실행은 바뀐 행만 raw 에 남음) 이 행의 지역·연도만 담은 Query 로 한 행씩 다시 만들고, `raw_url` 은 저장된 값을 씀. 수집기 종류는 job_run.collector_version 앞부분(kosis·airkorea)으로 고름. 측정소 정보는 아직 다시 만들지 않고 `skipped` 로 셈
- 2026-10-26: **결정** — held 행은 C1 을 어길 수 있어 C1 칸은 비우고 `record` 에만 둠(DB CHECK 로 pass·fixed 는 필수 C1 칸이 있어야 함). 다음 단계가 읽는 조건은 `normalized_ready` 뷰 한 곳에 둠
- 2026-10-26: 변형 확인 3가지 모두 테스트가 잡음 — 같은 결과면 UPDATE 건너뛰기 제거(2건 실패) · 뷰에서 최신본 조건 제거(1건) · 저장된 raw_url 대신 좁힌 조회 주소(1건). 되돌린 뒤 diff 로 원래 파일과 같은지 확인
- 2026-10-26: **덤프 실행**(일회용 PostGIS 에 V0001·V0002·V0005 + 덤프, 로컬 개발 DB 는 안 씀) — 1회차 `{"raw": 3186, "skipped": {}, "inserted": 3186, "updated": 0, "unchanged": 0, "status": {"pass": 3186}}`, 2회차 `inserted 0 · updated 0 · unchanged 3186`, refined_at 종류 1개. normalized 3,186 = raw 3,186, content_hash 로 3,186건 연결, normalized_ready 3,186 (S01 18 · airkorea_final 3,168), not_published 23. 여수 20–24세: 2023 -747 · 2024 -719 · 2025 -930
- 2026-10-26: 계약 `contracts/p2/README.md` v0.2(「저장」 절, 다시 만든 레코드가 JSONL 과 다른 점 3가지), `contracts/README.md` P2 행, `engine/README.md` 명령 2줄. 검사 — ruff check·format 통과, `pnpm engine:test` 222 passed, `pytest tests_postgres` 15 passed(수집기 10 + 정제 5)
- 2026-10-26: backend 검사 — PATH 에 Java 가 없어 `pnpm check` 가 backend format 에서 멈춤. IntelliJ 내장 Java 25 로는 backend test 는 통과(40건: Architecture 6 · BackendApplication 1 · FoundationMigration 11 · AuthIntegration 12 · ApiExceptionHandler 10, Gradle 이 `~/.gradle/jdks` 에 받아 둔 JDK 21 toolchain 으로 컴파일)했지만 Spotless 가 JVM 25 를 지원하지 않아 format 실패(google-java-format 1.24.0). 이번 명령에만 `JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-21-amd64-windows.2`(21.0.11) 로 `pnpm check` PASS — backend format 7.8s · backend test 3.6s(바로 앞 실행 결과 재사용) · engine lint 0.5s · engine test 7.0s(222). push 전 훅도 같은 JDK 가 필요하다
- 2026-10-26: finish — `pnpm check:all` PASS (이번 명령에만 `JAVA_HOME` = Gradle JDK 21): harness 1.6s · backend format 1.5s · frontend lint 48.9s · typecheck 15.8s · test 24.1s(9) · e2e 27.7s(1) · backend build 5.0s(바로 앞 test 실행 결과 재사용) · engine lint 0.5s · engine test 6.9s(222). 커밋 e233e0c. 변경은 새 파일 약 570줄 + 수정 84줄로 권장 300줄을 넘지만 목적 하나이고 절반 가까이가 테스트
- 2026-10-26: **결정(박준우) — 장부 만들기(rebuild)를 뺌.** 원본으로 장부(C1 레코드)를 만드는 건 C1 계약상 P1 역할인데, 위 구조는 P2 가 P1 변환 함수를 빌려 장부를 다시 만드는 임시 방식이었다. push 전이라 로컬 커밋 e233e0c·eb4be1a 를 풀고(`git reset --mixed c122c78`, 작업 파일은 그대로) 다시 정리한다. 장부는 `raw_record.c1_record` 에 두고 P1 이 채운다. 칸은 이 MR 의 V0005 가 만든다(P1 MR 과 번호가 엇갈리지 않게, P1 쪽은 저장 코드만 고치면 되게). P1 이 채우기 전까지는 정제 저장이 아무 행도 만들지 않는다 — 금요일 여수 1건은 P1 작업 일정에 달림. 완료 조건 1~3·5 번을 이 구조로 고침. 지운 `rebuild.py` 는 저장소 밖에 두고 덤프 확인에서만 「P1 이 장부를 채운 상황」을 흉내 내는 데 씀
- 2026-10-26: TDD — `tests_postgres/test_refine_store.py` 를 장부 기준으로 다시 씀(7건). 테스트에서 「P1 이 장부를 저장한 상황」은 수집기가 내보낸 C1 JSON 을 처음 저장된 원본의 `c1_record` 에 넣어 흉내 냄. 새 2건: 장부 없는 원본은 건너뛰고 source_id 별로 셈 · 장부 content_hash 가 원본과 다르면 `C1_HASH_MISMATCH` 로 멈추고 저장 0. `RefineStoreError` 가 없어 import 단계에서 실패하는 것을 확인한 뒤 V0005 에 `raw_record.c1_record` 추가, `store.py` 가 장부를 읽게 고침, `rebuild.py` · `tests/test_refine_rebuild.py` 삭제. 연결 칸(content_hash·source_id·spec_id)은 장부가 아니라 원본 쪽 값을 씀(held 장부는 칸이 비어 있을 수 있음)
- 2026-10-26: 변형 확인 — 장부 해시 검사 제거 → 해시 테스트 실패 · 「장부 없으면 건너뛰기」 제거 → 건너뛰기 테스트 실패. 되돌린 뒤 diff 로 원래와 같음 확인. `pytest tests_postgres` 17 passed(정제 7 + 수집기 10), `pnpm engine:test` 213 passed, ruff 통과
- 2026-10-26: **덤프 확인**(일회용 PostGIS 에 V0001·V0002·V0005 + 덤프) — ① 덤프 그대로: `{"raw": 3186, "skipped": {"S01": 18, "airkorea_final": 3168}, "inserted": 0, ...}` (장부 칸이 비어 모두 건너뜀) ② 저장소 밖 옛 rebuild 로 장부 3,186건을 채워 「P1 이 장부를 저장한 상황」을 흉내 낸 뒤: 1회차 inserted 3,186 (모두 pass), 2회차 unchanged 3,186, refined_at 종류 1개, normalized_ready 3,186, 여수 20–24세 2023 -747 · 2024 -719 · 2025 -930
- 2026-10-26: 문서 — `contracts/p2/README.md` 「저장」 절을 장부 읽기로 고침(다시 만든 레코드 차이 절은 뺌), `contracts/database/README.md` raw_record 행·변경 이력 v0.1.1, `engine/README.md` 명령 설명
- 2026-10-26: finish(다시) — `pnpm check:all` PASS (이번 명령에만 `JAVA_HOME` = Gradle JDK 21): harness 1.6s · backend format 1.6s · frontend lint 10.1s · typecheck 2.3s · test 2.6s(9) · e2e 10.1s(1) · backend build 36.9s(V0005 가 바뀌어 테스트까지 다시 돎) · engine lint 0.5s · engine test 5.9s(213). 커밋 0467b8b (10개 파일 +523 −7, 계획 파일 포함). 이전 커밋 e233e0c·eb4be1a 는 push 전에 풀어서 없음

## 다음 할 일 / 범위 밖
- **장성우 님께 요청(필수, 이게 없으면 정제 저장이 아무 행도 안 만듦)**: 수집기가 원본을 저장할 때 장부(C1 레코드)를 `raw_record.c1_record` 에 같이 넣기. `PostgresStore.save(rows, records)` 가 이미 장부(records)를 받으므로 INSERT 칸 하나. 재수집(ON CONFLICT)일 때 장부를 마지막 실행으로 갱신할지도 정해 주기. 그 뒤 덤프 다시 만들기
- 장성우 님께 확인: V0003 을 비워 둔 이유(나중에 V0003 이 들어오면 V0004 가 적용된 DB 에서 Flyway 검증이 실패할 수 있음)
- 장성우 님께 요청(-89 의 「spec_id 고정」 근거 보강): 덤프의 에어코리아 spec_id 가 `airkorea_final_20240101_20240102_560324e030cf` 처럼 기간·파일 해시를 담는다. 같은 측정소·시각을 다른 기간·파일로 다시 받으면 obs_key 가 달라지고(잠정 → 확정 판을 못 묶음), 같은 dedup_key 인데 spec_id 가 달라 DEDUP_KEY_CONFLICT 로 둘 다 held 가 된다. A3 2023–2025 백필 전에 정해야 함
- P2 후속: obs_key 를 spec_id·locator 대신 `contracts/c1/indicators.json` 의 dimensions 기준으로 만들기
- P2 후속: 지금은 장부 전체를 메모리에 올려 한 번에 정제한다. A3 2023–2025 백필(수백만 건) 전에 spec 단위로 나누기 (obs_key 가 spec_id 를 담으므로 spec 별로 최신본 판정이 닫힘 — spec_id 고정 결정과 같이 정함)
- `tests_postgres/test_collect_store.py`(장성우)도 conftest 의 `postgis` fixture 를 쓸 수 있음. 남의 테스트라 이번에 바꾸지 않음
- MR 본문: backend 의 V0005 PostGIS 검사는 Java 대신 `tests_postgres` 로 함(제약·뷰 동작). Flyway 로 V0001→V0005 적용은 backend 테스트(FoundationMigrationTest)가 JDK 21 있는 곳에서 확인
- MR 리뷰어: 정우현(P3, 이 테이블을 처음 읽음) · 최동준(P4) · 장성우(마이그레이션, P1 테이블 raw_record 에 칸 추가)
- 범위 밖: 전재 묶음(D-15) · 동일 내용 탐지(D-14) · 문서 칸(C1 v0.2 필요) · credibility · 범위 밖 값 검사(D-12) · P3·P4 결과 테이블 · `source.llm_allowed` 칸
