# feat/article-body-store — 기사 본문 수집 결과를 DB 에 저장해 P3 · P4 가 읽게 한다

- Jira: S15P31C108-112 · PRD: — · 묶음/단위: P2

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] Flyway V0007 로 news_article(news_id PK · 언론사 · 제목 · 발행 시각 · 분류 · url · status · http_status · fetched_at · fetcher · body) 와 news_article_ready 뷰를 만든다. body 는 status 가 ok 일 때만 있다 (CHECK)
- [x] `python -m pipeline.article --db <빅카인즈 응답 JSON>` 이 기사마다 결과를 저장한다. 다시 돌리면 이미 ok 인 기사는 요청하지 않고, 실패한 기사만 다시 시도하며, 중복 행이 생기지 않는다 (tests_postgres)
- [x] 기사 계약(`contracts/article/README.md`)에 테이블 · 뷰 · 상태 코드 · 「본문은 내부 분석용, 전문 노출 금지」 규칙을 적고 `contracts/README.md` 표에 더한다
- [x] `pnpm check` · tests_postgres · backend test(마이그레이션) 를 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-27: 시작
  - 기준 브랜치: 처음엔 MR !32 위에 쌓으려 했으나, !32 가 develop 에 머지돼 `origin/develop` 에서 다시 만들었다
  - C1 v0.2(S15P31C108-100) 문서 칸을 기다리지 않고 기사 전용 테이블에 둔다. C1 · raw_record 는 바꾸지 않는다. 수집기가 빅카인즈를 저장하게 되면 news_id 로 잇는다
  - 본문은 빅카인즈가 아니라 언론사 원문 페이지에서 받은 것이라 빅카인즈 이용허락(`BIGKINDS-이용약관` → metadata)은 그대로 둔다
  - S15P31C108-101 의 「원문 본문은 저장하지 않는다」 · 외부 확인(저장 허용 범위 · 보관 기간 · AI 분석 투입)과 부딪친다. 박준우가 팀에 공유하기로 함 — 머지 전 팀 확인 필요
- 2026-10-27: 구현
  - V0007 `news_article` · `news_article_ready`. raw_record 와 FK 없음. CHECK `(status = 'ok') = (body IS NOT NULL)`, status 8개 값
  - `pipeline/article/store.py` `store_articles`: 저장된 ok 기사는 요청 목록에서 빼고, 나머지를 받는 대로 한 행씩 UPSERT(ok 행은 덮지 않음). news_id 없는 기사가 있으면 요청 전에 `BIGKINDS_NEWS_ID_MISSING`. 한 응답의 같은 기사는 하나로
  - CLI `--db <파일>`: 루트 .env 의 DB 칸(정제 `--db` 와 같은 방식). 오류는 고정 코드(`DB_PASSWORD_MISSING` · `ARTICLE_DB_ERROR`)만 출력
  - tests_postgres +6(저장 · 메타데이터 · 다시 돌리기 · 같은 기사 두 번 · news_id 없음 · CHECK · CLI), conftest 에 `article_db`(스키마 만드는 부분을 `fresh_schema` 로 묶음). 단위 테스트 +3(사용법 · DB 설정 없음)
  - 계약: `contracts/article/README.md` v0.1, `contracts/README.md` 표, `contracts/database/README.md` v0.1.4, engine README
  - 확인: P4 시험 자료(.local/p4-dataset)에서 같은 형식으로 빅카인즈 30건을 저장해 봄 — 본문 20건 · 실패 10건(링크 없음 6 · robots 3 · 기사 불일치 1)
  - 마무리: `pnpm check`(backend format · backend test · engine lint · engine test 273건) · `pytest tests_postgres`(31건) 통과
  - `pnpm check:all`: engine test 를 뺀 8단계 통과. engine test 는 KOSIS 수집기 테스트(`test_success_repeat_and_c1_cli_handoff`)가 한 번 `C1_EXPORT_FAILED`(Windows 에서 출력 파일 교체 실패)로 실패 — 이 브랜치가 건드리지 않은 코드이고, 그 테스트 3회 · `pnpm engine:test`(273건) 다시 돌려 통과

## 다음 할 일 / 범위 밖
- 빅카인즈 자동 수집(P1, S15P31C108-101) — 그 전까지 입력은 빅카인즈 응답 파일
- 기사 P2 정제(필수 칸 · 저장 범위 판정 · 전재 묶기) — C1 v0.2(S15P31C108-100) 뒤. 시험 초안은 .local/p4-dataset 의 `refine_news.py`(본문 5글자 조각 Jaccard 0.6)
- 본문 보관 기간 · 삭제 규칙
- 예약 실행
