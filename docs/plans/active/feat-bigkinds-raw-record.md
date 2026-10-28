# feat/bigkinds-raw-record — 빅카인즈 기사를 raw_record 와 장부(C1 기사 칸)로 저장

- Jira: S15P31C108-101 · PRD: v4.1 7.1·7.5 · 묶음/단위: P1
- 기준: feat/c1-document-record(3945396, -100) 위. -100 이 먼저 머지돼야 한다

## 완료 조건
- [x] 빅카인즈 뉴스 검색(여수·광주)을 날짜 구간으로 받고, 요청 fields 에 provider_link_page·content 를 넣는다
- [x] 기사마다 원문 본문 수집(pipeline.article.fetch_articles)을 거쳐 기사 하나를 raw_record 한 행으로, 장부(c1_record)와 함께 저장한다
- [x] 이미 본문을 받은 기사는 다시 요청하지 않는다
- [x] 실제 빅카인즈 하루치로 로컬 DB 적재와 P2 정제 확인
- [ ] 원문 본문 저장은 팀·멘토 확인 결과를 따른다(박준우 공유 예정)
- [x] engine lint·test, tests_postgres 통과

## 진행
- 2026-10-28: 박준우 요청(기사도 raw_record → P2 → normalized_record 흐름으로)으로 시작. 10/26 초안(feat/bigkinds-collector: 계약 확인 JSON · 하루 호출량 잠금 · 체크포인트)은 가져오지 않고 단순하게 다시 짬. 그 브랜치는 지우지 않고 둔다.
- 결정: 원본 지문(content_hash)에서 본문 요청 시각을 뺌 → 같은 기사 · 같은 결과는 같은 원본. dedup_key 에 본문 수집 상태를 넣어 실패 뒤 성공이 DEDUP_KEY_CONFLICT 가 되지 않게 함.
- P2 입구가 빈 place_code_raw 를 필수 칸 누락으로 막아, 수집 검색어(`여수 OR 광주`)를 남기고 C1 README 에 적음.
- store.start: source 저장 범위·evidence_class 를 query 가 정하게 함(통계는 그대로 full · statistics).
- 단위 테스트(가상 검색 · 가상 기사 HTML), tests_postgres(원본 · 장부 · 재실행 생략 · refine_raw) 통과.
- 실제 빅카인즈 2025-10-01 하루: 검색 11번, 기사 1,091건 모두 raw_record + 장부. 본문 ok 862(79%) · NO_LINK 72 · ROBOTS_DISALLOWED 56 · HTTP_ERROR 45 · CONTENT_MISMATCH 34 · NO_BODY 20 · NO_REFERENCE 2. 약 25분(사이트별 1초 간격).
- `refine --db`: 빅카인즈 1,091건 pass 229 · fixed 862. fixed 는 이용허락 표(BIGKINDS → metadata)로 full 이 metadata 로 내려간 것인데 normalized_record.record 에 body 862건이 그대로 남는다 → 박준우 확인 필요.
- pnpm check(engine 311건), tests_postgres 통과.

## 다음 할 일 / 범위 밖
- 하루 할당량(PRD: 80%) 합산 — 할당량이 정해지면
- P2: 이용허락 표 BIGKINDS → metadata 가 full 기사 장부의 저장 범위를 바꾸면서 body 는 남긴다. 본문 지우기 · 표 변경은 박준우 결정
- news_article(-112) 표와 잇기·정리는 박준우 쪽
