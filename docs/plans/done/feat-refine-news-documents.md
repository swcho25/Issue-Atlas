# feat/refine-news-documents — 기사(문서) 레코드 정제 규칙

- Jira: S15P31C108-122 · PRD: FR-E3(본문 저장 — 팀 결정 2026-10-28로 저장) · 묶음/단위: P2

## 완료 조건
- [x] 본문을 받은 빅카인즈 기사는 정제 뒤에도 storage_scope=full 이고 body 가 그대로 남는다
- [x] 저장 범위가 full 이 아닌 문서는 정제 뒤 body 가 null 이 된다 (사유를 남기고 fixed)
- [x] 같은 기사(news_id)의 여러 행 중 1건만 normalized_ready 에 남는다. 본문 받은 행이 먼저, 같으면 늦게 받은 행
- [x] 문서(source_text)는 place_code_raw 가 빈 칸이어도 통과한다
- [x] P2 계약 문서 · engine 테스트 반영

## 진행
- 2026-10-28: 시작. 배경 — 기사 본문 저장은 팀에서 정했다. C1 v0.2 기사 칸(MR !41)은 병합됐고, 빅카인즈 수집기(MR !42)가 하루치(2025-10-01) 1,091건을 정제해 보니 fixed 862건이 이용허락 표(BIGKINDS-이용약관 → metadata) 때문에 metadata 로 내려가면서 record 안 본문은 그대로 남았다. 실패 → 성공 다시 받기는 dedup_key 가 달라 두 행 모두 다음 단계로 넘어가고, P2 입구가 빈 place_code_raw 를 막아 수집기가 검색어를 넣었다
- 2026-10-28: 구현. 이용허락 표 키를 `observation` → `limits`(관측값 · 문서 공통)로 바꾸고 `BIGKINDS-이용약관` → `full`. 저장 범위 게이트가 full 이 아닌 문서의 `document.body` 를 지우고 `BODY_STRIPPED_BY_SCOPE`(fixed). `obs_key` 를 문서에도 붙이고(source_id · spec_id · locator), 문서의 대표 판은 본문 있음 → collected_at → dedup_key 순. `source_text` 문서는 `place_code_raw = ""` 허용. `rule_version` p2-0.3.0. P2 계약 v0.5, C1 README · 기사 계약 문구(본문 저장 결정)
- 2026-10-28: 검증. `pnpm check`(engine lint · test 324건) · `tests_postgres` 40건 통과. 새 테스트: tests/test_refine_documents.py 11건, tests_postgres 같은 기사 실패 → 성공 두 행 중 본문 있는 1건만 normalized_ready. 실제 기사 장부(P3 전달용 2,996건, C1 v0.2 모양)를 새 규칙으로 정제: pass 2,996 · full 2,204(본문 그대로) · metadata 792

- 2026-10-28: finish. `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build · engine lint · engine test 324건). 로컬 P3 전달 DB 에 기사 2,996건을 이 규칙으로 정제해 넣음(pass 2,996 · full 2,204)

- 2026-10-28: 본문 없는 기사 보류(사람 결정). 이용허락이 full 을 허락하는 기사(`kind = news`)인데 `document.body` 가 없으면 `BODY_MISSING`(held) — P3 가 본문을 읽으므로 다음 단계로 넘기지 않는다. 보도자료는 그대로

## 다음 할 일 / 범위 밖
- `news_article` 표 · `news_article_ready` 뷰(V0007, S15P31C108-112) 정리 — 기사가 raw_record 로 들어가므로 새 마이그레이션으로 지운다. DB 변경이라 따로
- 전재 묶음(syndication) 칸 — P2 계약 「아직 없는 것」
- 문서의 관측 일 묶음 — 문서는 관측 시각이 비어 `refine --db` 에서 모두 `''` 한 묶음이다. 기사가 많아지면(빅카인즈 `여수 OR 광주` 하루 약 1,000건) 발행일로 나눈다
- 빅카인즈 수집기(MR !42, 장성우): 이 MR 뒤에는 `place_code_raw` 를 검색어 대신 `""` 로 둘 수 있다. dedup_key(`bigkinds:<news_id>:<수집 상태>`)는 그대로 두면 된다
- PRD FR-E3 문구 고치기(Notion) — 사람
- 보도자료(press_release, V0010)를 C1 문서 칸(kind=press_release)으로 옮길지
