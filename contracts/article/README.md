# 기사 본문 수집 v0.2

빅카인즈 원문 링크 → 언론사 페이지 → 본문. 만드는 곳: `engine/pipeline/article/` (`fetch_articles`).
빅카인즈 수집기(`python -m pipeline.collect.bigkinds`, P1)가 기사마다 이 결과를 C1 기사 칸(`document.fetch` · `document.body`, [C1](../c1/README.md) v0.2)으로 `raw_record` 에 저장하고, P2 정제([P2 계약](../p2/README.md) v0.5)가 `normalized_record` 로 옮긴다. 다음 단계(P3 요약 · P4 분류)는 `normalized_ready` 를 읽는다.
계약 변경은 받는 쪽 정우현(P3) · 최동준(P4) 리뷰가 필요하다.

## 흐름

1. 빅카인즈 뉴스 검색 응답(`return_object.documents`)을 받는다. 요청 fields 에 `provider_link_page` · `content` 가 있어야 한다
2. 기사마다 원문 링크(`provider_link_page`)의 언론사 페이지에서 본문을 뽑는다. robots.txt 가 막은 주소는 요청하지 않고, 같은 사이트 요청 사이에 1초 간격을 둔다
3. 뽑은 본문이 빅카인즈 `content`(본문 앞 200자)와 같은 기사일 때만 남긴다
4. 기사마다 결과 하나를 낸다. 실패한 기사도 이유(`status`)와 함께 나온다

`python -m pipeline.article <빅카인즈 응답 JSON>` 은 같은 수집을 JSONL 로만 출력한다(확인용, DB 에 저장하지 않음).

## 결과 상태 — C1 `fetch.status`

| `status` | 뜻 |
| --- | --- |
| `ok` | 본문을 받았고 빅카인즈 기사와 같다 |
| `NO_LINK` | 빅카인즈가 원문 링크를 주지 않았거나 쓸 수 없는 링크 |
| `NO_REFERENCE` | 빅카인즈 `content` 가 없어 같은 기사인지 확인할 수 없어 요청하지 않음 |
| `ROBOTS_DISALLOWED` | robots.txt 가 막음 (401 · 403 · 5xx 도 막은 것으로 본다) |
| `NETWORK_ERROR` · `HTTP_ERROR` | 연결 · 인증서 · 시간 초과 / 2xx 가 아닌 응답 |
| `NO_BODY` | 페이지에서 본문을 찾지 못함 |
| `CONTENT_MISMATCH` | 뽑은 본문이 빅카인즈 기사와 다름 |

## 이용 규칙

- **본문은 내부 분석(요약 · 분류 · 관련 문장 찾기)에만 쓴다.** 카드 · API · 화면에 기사 전문을 내보내지 않는다. 화면에는 요약 · 짧은 관련 문장 · 원문 링크만 쓴다
- 본문은 빅카인즈가 준 것이 아니라 언론사 원문 페이지에서 받은 것이다. 기사 본문은 저장하기로 했다(팀 결정 2026-10-28) — P2 이용허락 표 `BIGKINDS-이용약관` → `full`([P2 계약](../p2/README.md) v0.5)
- robots.txt 와 봇 차단을 우회하지 않는다. User-Agent 는 `IssueAtlasBot/0.1 (SSAFY C108 Issue Atlas)`

## 열린 문제

- 보관 기간 · 삭제 규칙이 없다

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-27 | 초안: `news_article`(V0007) · `news_article_ready` 뷰, 상태 코드 8개, 다시 돌리기 규칙, 이용 규칙 (S15P31C108-112) |
| v0.2 | 2026-10-29 | 기사 전용 표를 없앴다. 기사는 C1 기사 칸으로 `raw_record` → `normalized_record` 에 저장한다. `news_article` · `news_article_ready` 는 V0012 가 지우고, `pipeline.article --db` 를 뺐다. 상태 코드 · 이용 규칙은 그대로 (S15P31C108-128) |
