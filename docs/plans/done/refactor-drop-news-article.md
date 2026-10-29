# refactor/drop-news-article — 기사 본문 표 news_article 정리

- Jira: S15P31C108-128 · PRD: FR-E3 · 묶음/단위: P2-3

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] Flyway V0012 가 news_article_ready 뷰와 news_article 표를 지운다. V0007 파일은 그대로 두고 backend test(마이그레이션 전체 적용)가 통과한다
- [x] python -m pipeline.article 는 JSONL 출력만 남기고 --db · store.py 를 없앤다. 빅카인즈·보도자료 수집기가 쓰는 본문 수집 코드(fetch_articles · fetch.py)는 그대로다
- [x] news_article 을 가리키는 코드·테스트가 남지 않는다 (V0007 · V0012 마이그레이션과 계약 변경 이력은 예외)
- [x] contracts/article · contracts/README · contracts/database · engine/README 가 "기사는 raw_record → normalized_record 로 간다"를 기준으로 고쳐진다
- [x] pnpm check(engine · backend)와 engine tests_postgres 가 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-28: 시작. 구현 전에 멈춤(사람 결정: 나중에)
- 2026-10-29: S15P31C108-112 · S15P31C108-122 Jira `완료` 전이함
- 2026-10-29: 구현. 마이그레이션 번호를 V0011 → **V0012** 로 바꿈 — `origin/feat/place-list-api`(장성우, 지역 목록 API)가 `V0011__seed_places.sql` 을 먼저 씀. Flyway 는 outOfOrder 꺼짐(기본값)이라 이 MR 은 그 브랜치 **다음에** 머지해야 한다. 그쪽이 늦어지면 머지 전에 번호를 다시 맞춘다
- 2026-10-29: `contracts/article` 은 지우지 않고 v0.2 로 고침 — C1 README 의 `fetch.status` 가 상태 코드 뜻을 이 문서에 기대므로 표 부분만 빼고 흐름 · 상태 코드 · 이용 규칙은 남김
- 2026-10-29: `test_cli_usage` 의 `["--db"]` 경우를 `["--db", "a.json"]` 로 바꿈 — 예전 사용법이 사용법 오류(2)로 끝나는지 본다
- 2026-10-29: 검사 통과 — pnpm check(backend format · backend test · engine lint · engine test 339), tests_postgres 34. Docker 가 꺼져 있어 Docker Desktop 을 켜고 실행
- 2026-10-29: finish — `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build · engine lint · test). 커밋, MR 본문 초안

## 다음 할 일 / 범위 밖
- MR 본문에 적을 것: ① `feat/place-list-api`(V0011) 다음에 머지 ② 머지·배포되면 개발 서버 `news_article` 에 있던 행이 지워진다(기사는 빅카인즈 수집기가 `raw_record` 에 다시 저장한다)
- 지우면 안 되는 것: `pipeline/article` 의 `fetch_articles`(collect/bigkinds.py) · `fetch.py` 의 `USER_AGENT` · `Pacer` · `http_getter`(collect/press.py)
- 범위 밖: `press_release`(V0010, 장성우)는 보도자료 수집기가 지금도 저장하므로 그대로. 개발 서버 `news_article` 에 행이 있는지는 확인 못 함
- 범위 밖: 카드 C1 의 ② 기사·보도 근거(SP04·SP05 보도자료)는 `press_release` 에만 있고 `normalized_record` 를 거치지 않는다 — S15P31C108-126(카드 양식) 리뷰 때 읽는 곳을 정할 것
