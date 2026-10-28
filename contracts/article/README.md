# 기사 본문 v0.1 — `news_article`

본문 수집(P2) → 요약(P3) · 분류(P4). 만드는 곳: `python -m pipeline.article --db <빅카인즈 응답 JSON>` (`engine/pipeline/article/store.py`). 테이블은 Flyway [V0007](../../backend/src/main/resources/db/migration/V0007__create_news_article.sql).
계약 변경은 받는 쪽 정우현(P3) · 최동준(P4) 리뷰가 필요하다.

## 흐름

1. 빅카인즈 뉴스 검색 응답(`return_object.documents`)을 받는다. 요청 fields 에 `provider_link_page` · `content` 가 있어야 한다
2. 기사마다 원문 링크(`provider_link_page`)의 언론사 페이지에서 본문을 뽑는다. robots.txt 가 막은 주소는 요청하지 않고, 같은 사이트 요청 사이에 1초 간격을 둔다
3. 뽑은 본문이 빅카인즈 `content`(본문 앞 200자)와 같은 기사일 때만 남긴다
4. 기사 하나를 한 행으로 저장한다. 실패한 기사도 이유(`status`)와 함께 남는다

## 저장 — `news_article`

| 칸 | 뜻 |
| --- | --- |
| `news_id` | 빅카인즈 기사 ID (PK). 나중에 수집기(P1)가 빅카인즈를 `raw_record` 에 저장하면 이 값으로 잇는다 |
| `provider` · `title` · `published_at` · `category` | 빅카인즈 응답의 언론사 · 제목 · 발행 시각 · 분류(빈 분류는 뺀 배열) |
| `url` | 실제로 요청한 원문 주소. `http://` 가 빠진 링크는 붙이고, 쓸 수 없는 링크면 null |
| `status` | 아래 표 |
| `http_status` · `fetched_at` | 원문 페이지 응답 코드 · 요청 시각(UTC). 요청 전에 멈췄으면 null |
| `fetcher` | 수집기 판 (`article-0.1.0`) |
| `body` | 뽑은 본문. **`status` 가 `ok` 일 때만 있다** (CHECK) |
| `stored_at` | 이 행이 마지막으로 바뀐 시각 |

| `status` | 뜻 |
| --- | --- |
| `ok` | 본문을 받았고 빅카인즈 기사와 같다 |
| `NO_LINK` | 빅카인즈가 원문 링크를 주지 않았거나 쓸 수 없는 링크 |
| `NO_REFERENCE` | 빅카인즈 `content` 가 없어 같은 기사인지 확인할 수 없어 요청하지 않음 |
| `ROBOTS_DISALLOWED` | robots.txt 가 막음 (401 · 403 · 5xx 도 막은 것으로 본다) |
| `NETWORK_ERROR` · `HTTP_ERROR` | 연결 · 인증서 · 시간 초과 / 2xx 가 아닌 응답 |
| `NO_BODY` | 페이지에서 본문을 찾지 못함 |
| `CONTENT_MISMATCH` | 뽑은 본문이 빅카인즈 기사와 다름 |

**다시 돌리기:** 이미 `ok` 인 기사는 다시 요청하지 않는다. 실패한 기사만 다시 받아 그 결과로 덮어쓴다. 한 응답에 같은 기사가 두 번 와도 한 행이다. 기사마다 받는 대로 저장하므로 중간에 멈춰도 앞 기사는 남는다.

**다음 단계가 읽는 곳은 `news_article_ready` 뷰다.** 본문을 받은(`ok`) 기사만, `status` · `http_status` · `stored_at` 없이 보여 준다.

## 이용 규칙

- **본문은 내부 분석(요약 · 분류 · 관련 문장 찾기)에만 쓴다.** 카드 · API · 화면에 기사 전문을 내보내지 않는다. 화면에는 요약 · 짧은 관련 문장 · 원문 링크만 쓴다
- 본문은 빅카인즈가 준 것이 아니라 언론사 원문 페이지에서 받은 것이다. 기사 본문은 저장하기로 했다(팀 결정 2026-10-28) — P2 이용허락 표 `BIGKINDS-이용약관` → `full`([P2 계약](../p2/README.md) v0.5)
- robots.txt 와 봇 차단을 우회하지 않는다. User-Agent 는 `IssueAtlasBot/0.1 (SSAFY C108 Issue Atlas)`

## 열린 문제

- 보관 기간 · 삭제 규칙이 없다
- 이 표(`news_article`)는 쓰지 않게 된다. 기사는 C1 문서 칸(S15P31C108-100)으로 `raw_record` → `normalized_record` 에 들어가고 P2 정제(P2 계약 v0.5)를 거친다. 표는 따로 정리한다
- 입력은 빅카인즈 응답 파일이다. 수집기(P1)가 빅카인즈를 DB 에 저장하면 그쪽에서 읽게 바꾼다

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-27 | 초안: `news_article`(V0007) · `news_article_ready` 뷰, 상태 코드 8개, 다시 돌리기 규칙, 이용 규칙 (S15P31C108-112) |
