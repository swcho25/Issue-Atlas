# 보도자료 목록 v0.2 — C1 문서(`kind = press_release`)

지자체 보도자료 게시판의 **목록**을 받아 C1 문서 레코드로 원본 장부(`raw_record` · `job_run`)에 둔다. P2 정제를 거쳐 `normalized_ready` 로 나간다.
만드는 곳: `python -m pipeline.collect.press --site yeosu|gwangju --db` (`engine/pipeline/collect/press.py`).
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

## 저장 — 원본 장부 · C1 문서 레코드

게시판 하나 = 출처(`source`) 하나 · 수집 명세(`source_spec`) 하나. 이용허락이 달라 나눈다. 실행마다 `job_run` 한 행(쪽 수 · 받은 글 · 새 원본 · 같은 원본 수, 실패면 `error_code`).

| 게시판 | `source_id` | `spec_id` | `license_type` |
| --- | --- | --- | --- |
| 여수시 | `press_yeosu` | `press_release_yeosu` | `KOGL-4` |
| 광주광역시 | `press_gwangju` | `press_release_gwangju` | `KOGL-미표시` |

원본(`raw_record.payload`)은 목록에 보이는 칸 그대로다: `press_id`(`<site>:<게시판 글 번호>`) · `category` · `department`(광주광역시 목록에는 없어 null) · `title`(광주광역시는 잘리지 않은 링크 title 속성) · `published_on`(등록일, 한국 날짜) · `url`(글 보기 주소).

C1 레코드(`raw_record.c1_record`)에서 기사와 다른 칸

| 칸 | 값 |
| --- | --- |
| `raw_url` | 쪽 번호 · 기간이 없는 게시판 주소. 같은 글은 어느 쪽에서 읽어도 같다 |
| `published_at` | 등록일 0시(+09:00). 목록에 시각이 없다 |
| `place_code_raw` · `place_code_system` | 발행 기관의 KOSIS 지역 코드 · `kosis`. 여수시 `46130`, 광주광역시 `29`(시 전체). 글이 다루는 지역은 P3 가 정한다 |
| `locator` | `{press_id}` — 같은 글의 판을 묶는 칸(P2 `obs_key`) |
| `dedup_key` | `press:<press_id>:<보이는 칸 지문 12자리>` |
| `storage_scope` | 늘 `metadata`. `document.body` · `excerpt` · `fetch` 는 null |
| `document` | `kind = press_release`, `publisher` 기관명, `categories` 게시판 분류(없으면 `[]`), `link` 글 보기 주소. 담당부서는 C1 문서 칸에 없어 원본에만 있다 |

**다시 돌리기:** 같은 글을 그대로 다시 받으면 원본 지문(`content_hash`)이 같아 새 행이 생기지 않는다(`duplicates`). 제목 · 분류 · 담당부서 · 등록일 · 링크가 바뀌면 새 원본 · 새 판이고, P2 가 늦게 받은 판 하나만 `is_latest` 로 낸다(옛 판도 장부에 남는다).

**`press_release` 표(V0010)** 는 이제 채우지 않는다. 개발 서버에서 새 경로로 다시 받은 것을 확인한 뒤 지운다.

## 열린 문제

- `press_release` 표(V0010) 지우기 — 개발 서버 재수집 확인 뒤
- 광주광역시 본문 이용은 누리집 담당자 협의가 필요하다. 2026-07 이후 글(통합특별시 임시 누리집)은 범위 밖
- 광산구 등 자치구 보도자료는 범위 밖

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-28 | 초안: `press_release`(V0010), 여수시 · 광주광역시 목록, 실패 코드, 다시 돌리기 규칙 |
| v0.2 | 2026-11-02 | C1 문서 레코드로 원본 장부 · `job_run` 에 저장하고 P2 정제를 거친다. 게시판마다 출처 · 수집 명세. 정정된 글은 새 판, 최신본만 `normalized_ready`. 수집기 `press-0.2.0`, `--output` 은 C1 레코드 JSONL. `press_release` 표는 더 채우지 않는다 (S15P31C108-172) |
