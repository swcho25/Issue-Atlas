# 보도자료 목록 v0.1 — `press_release`

지자체 보도자료 게시판의 **목록**을 받아 둔다. 만드는 곳: `python -m pipeline.collect.press --site yeosu|gwangju --db` (`engine/pipeline/collect/press.py`). 테이블은 Flyway [V0010](../../backend/src/main/resources/db/migration/V0010__create_press_release.sql).
계약 변경은 받는 쪽 박준우(P2) · 정우현(P3) 리뷰가 필요하다.

## 왜 목록만인가

| 게시판 | 이용 조건 | 그래서 |
| --- | --- | --- |
| 여수시 [보도자료](https://www.yeosu.go.kr/www/govt/news/release) | 글마다 **공공누리 4유형**(출처표시 · 상업적 이용금지 · 변경금지) | P2 이용허락 표 `KOGL-4 → metadata`. 본문을 두지 않는다 |
| 광주광역시 [보도자료](https://www.gwangju.go.kr/boardList.do?boardId=BD_0000000027&pageId=www789) | 공공누리 **표시 없음**. 누리집 저작권 정책: 표시 없는 자료는 담당자와 사전 협의 | 협의 전이라 본문을 두지 않는다 (`KOGL-미표시`) |

목록에 보이는 칸(제목 · 분류 · 담당부서 · 등록일 · 링크)만 쓰므로 글 보기 페이지는 요청하지 않는다. 화면에는 제목 · 등록일 · 원문 링크와 출처(기관명)를 보인다.

## 수집 방법

- robots.txt 를 먼저 읽고 막혔으면 멈춘다(401 · 403 · 5xx 도 막힌 것으로 본다). 2026-10-28 기준 두 곳 모두 게시판 허용
- 같은 사이트 요청 사이 간격 = robots.txt `Crawl-Delay`(여수시 30초)와 2초 중 큰 값. 동시 요청 없음. User-Agent `IssueAtlasBot/0.1 (SSAFY C108 Issue Atlas)`
- 한 쪽에 100건씩 읽는다
  - 여수시: 서버가 기간으로 거르지 않는다. 최신 글부터 읽다가 시작일보다 오래된 글이 나온 쪽에서 멈춘다(2023–2025 는 약 100쪽 · 50분)
  - 광주광역시: 서버가 기간(`searchSDe`·`searchEDe`)으로 거른다. 2023–2025 는 6,852건 · 69쪽. **2026-07-01 행정통합 뒤 새 글은 통합특별시 임시 누리집에 있다**(이 게시판은 2026-06-30 까지)
- 쪽마다 받는 대로 저장한다. 중간에 멈춰도 앞 쪽은 남는다. 실패는 고정 코드로 끝난다

| 실패 코드 | 뜻 |
| --- | --- |
| `PRESS_ROBOTS_DISALLOWED` | robots.txt 가 막음 |
| `PRESS_NETWORK_ERROR` · `PRESS_HTTP_<코드>` | 연결 · 시간 초과 / 200 이 아닌 응답 |
| `PRESS_NO_ROWS` | 첫 쪽에 글이 없음 — 게시판 모양이 바뀌었을 수 있다 |
| `PRESS_UNRECOGNIZED_ROW` | 글 번호 · 제목 · 날짜(`YYYY-MM-DD`)를 읽지 못함 |
| `PRESS_TOO_MANY_PAGES` | 300쪽을 넘김 — 끝을 찾지 못함 |

## 저장 — `press_release`

| 칸 | 뜻 |
| --- | --- |
| `press_id` | `<site>:<게시판 글 번호>` (PK). 예: `yeosu:584169`, `gwangju:22211` |
| `site` · `org` | `yeosu` 여수시 · `gwangju` 광주광역시 |
| `place_code_raw` | 발행 기관의 KOSIS 지역 코드(옛 코드). 여수시 `46130`, 광주광역시 `29`(시 전체). P3 가 지역에 잇는다 |
| `category` · `department` | 게시판 분류 · 담당부서. 광주광역시 목록에는 담당부서가 없어 null |
| `title` | 전체 제목. 광주광역시 목록 글자는 길면 잘리므로 링크의 title 속성을 쓴다 |
| `published_on` | 게시판 등록일(한국 날짜). 목록에 시각이 없다 |
| `url` | 글 보기 주소(목록 검색 조건 없이) |
| `license_type` · `storage_scope` | `KOGL-4` / `KOGL-미표시` · 항상 `metadata`(CHECK) |
| `collected_at` · `collector` | 그 쪽을 받은 시각(UTC) · 수집기 판(`press-0.1.0`) |
| `stored_at` | 이 행이 마지막으로 바뀐 시각 |

**다시 돌리기:** 같은 글은 한 행이다. 제목 · 분류 · 담당부서 · 등록일 · 링크가 바뀐 때만 덮어쓴다(`updated`). 그대로면 손대지 않는다(`unchanged`).

## 열린 문제

- C1 문서 칸(S15P31C108-100)이 생기면 raw_record · P2 정제와 잇는다. 그때 `press_id` 로 찾는다
- 광주광역시 본문 이용은 누리집 담당자 협의가 필요하다. 2026-07 이후 글(통합특별시 임시 누리집)은 범위 밖
- 광산구 등 자치구 보도자료는 범위 밖

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-28 | 초안: `press_release`(V0010), 여수시 · 광주광역시 목록, 실패 코드, 다시 돌리기 규칙 |
