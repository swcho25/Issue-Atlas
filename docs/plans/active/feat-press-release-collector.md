# feat/press-release-collector — 여수시·광주광역시 보도자료 목록 수집

- Jira: (미생성 — 사람이 만든 뒤 키 기입) · PRD: v4.0 카드 C1 · SP04 · 묶음/단위: P1
- 기준: origin/develop a413a05, 2026-10-28

## 완료 조건
- [x] `python -m pipeline.collect.press --site yeosu|gwangju --db` 가 2023–2025 보도자료 목록(제목·분류·담당부서·등록일·링크)을 `press_release`(V0010)에 넣는다
- [x] robots.txt 를 지키고(여수시 Crawl-Delay 30초), 본문은 저장하지 않는다(`storage_scope = metadata` CHECK)
- [x] 다시 돌리면 바뀐 글만 덮어쓰고, 중간 실패 때 앞 쪽은 남는다(DB 테스트)
- [ ] 실제 게시판으로 로컬 DB 적재 확인
- [x] engine lint·test, tests_postgres, backend test(Flyway) 통과

## 진행
- 2026-10-28: 시작. -100(C1 문서 칸)을 기다리지 않고 news_article 처럼 따로 표를 둔다(박준우 -112 와 같은 결정).
- 이용 조건 확인: 여수시 글마다 공공누리 4유형 → P2 표 KOGL-4 = metadata. 광주광역시는 표시 없음, 저작권 정책상 사전 협의 필요 → metadata. 그래서 목록만 읽고 글 보기 페이지는 요청하지 않는다.
- 게시판 확인: 여수시 `page_scale=100` 가능, 기간 거르기는 GET 으로 안 됨 → 최신부터 읽다 시작일 이전에서 멈춤. 광주광역시 `searchSDe/searchEDe` 로 2023–2025 6,852건 · 69쪽. 광주 게시판은 2026-06-30 까지(행정통합).
- robots.txt: 여수시 `Allow:/` · Crawl-Delay 30, 광주광역시 게시판 경로 허용.
- 광주광역시 실제 목록(DB 없이): 첫 시도 66쪽에서 연결 끊김 → 끊김·5xx 는 같은 간격으로 3번까지 시도하게 고침. 다시 돌려 6,852건(2023 2,480 · 2024 2,167 · 2025 2,205), 글 번호 중복 없음, 약 2분. 제목에 「청년」 212건.
- Docker Desktop 꺼짐 → DB 테스트·적재 대기.
- Docker 켠 뒤: tests_postgres 39건(보도자료 3건 포함) 통과. 로컬 DB Flyway V0006–V0010 적용(backend 실행). 광주광역시 --db 6,852건 inserted(3분 10초), 2025-12 다시 돌리기 174건 unchanged. `pnpm check` 통과(backend format·test, engine lint·test 290건).
- 여수시 --db 실행 중(약 50분). 끝나면 결과를 적는다.

## 다음 할 일 / 범위 밖
- 
