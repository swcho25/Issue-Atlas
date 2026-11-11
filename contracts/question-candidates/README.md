# 관리자 새 이슈 후보 목록 API v0.1 — S15P31C108-345

새 질문 화면의 「새 이슈 후보 만들기」로 저장한 질문(`card_id` 없음, FR-A3)을 관리자가 보는 **읽기 전용** 목록이다.
사용자 창은 「관리자가 이슈 카드로 만들지 검토해요」라고 안내하지만 지금까지 관리자가 볼 곳이 없었다.
관리자 화면(frontend) 리뷰 대상. 기계 명세는 [openapi.json](openapi.json), 예시는 [examples/](examples/).

- ADMIN 세션이 필요하다. 미로그인 401, VIEWER 403. 오류 본문은 [HTTP 오류](../http-errors/).
- 새 표 · Flyway 없음. `question` · `place` · `app_user` 를 읽기만 하고 질문 · 실행을 고치지 않는다.

## 경로

| GET 경로 | 쿼리 | 응답 |
| --- | --- | --- |
| `/v1/admin/question-candidates` | `place_id?`, `page?`(기본 1), `size?`(기본 20, 최대 100) | QuestionCandidatePage |

- `place_id` 는 일치 조건이다. 없는 지역이면 빈 목록(200). 빈 값 · 제어 문자 · 200자 넘는 값은 400.
- `page` < 1, `size` 가 1–100 밖이면 400.
- 정렬은 접수 시각(`created_at`) 최신 순, 같으면 `question_id` 순.

## 응답

`{items: QuestionCandidate[], total, page, size}` — `total` 은 거른 뒤 전체 건수.

| 칸 | 뜻 |
| --- | --- |
| `question_id` | 질문 ID. 내 질문 · 질문 저장 응답의 `question_id` 와 같다 |
| `place_id` · `place_name` | 지역 ID와 지금 표시 이름 |
| `period_start` · `period_end` | 질문 기간 `[start, end)`, `YYYY-MM-DD` |
| `issue_name` | 「이슈 이름:」 줄의 값. 줄이 없으면 null |
| `reason` | 「궁금한 까닭:」 줄의 값. 줄이 없으면 null |
| `sentence` | 위 두 줄을 뺀 나머지 줄(사용자가 쓴 문장). 없으면 null |
| `raw_text` | 저장된 원문 그대로. null 일 수 있다 |
| `asked_by` | 묻는 사람 `{id, name, email}`. 로그인 없이 물었거나 묻는 사람 칸(V0050) 전 질문이면 null |
| `created_at` | 접수 시각, 오프셋 포함 ISO 8601 |

### raw_text 를 나누는 규칙

후보 창은 이름 · 까닭 칸을 따로 보내지 않고 원문에 줄로 붙여 저장한다(`frontend/src/pages/ask/ui/CandidateDialog.tsx`).

```
2024년 여수 관광객 수는 어떻게 변했나
이슈 이름: 관광객 수
궁금한 까닭: 축제 뒤 방문객이 늘었는지 보고 싶다
```

- 줄마다 앞뒤 공백을 지운다. 「이슈 이름:」 · 「궁금한 까닭:」 으로 시작하는 **첫** 줄이 그 칸이고, 값이 비면 null.
- 나머지 비지 않은 줄을 줄바꿈으로 이어 `sentence` 로 둔다(같은 머리말의 두 번째 줄도 여기 들어간다).
- 이름 줄이 없을 때 화면에 무엇을 제목으로 쓸지는 화면이 정한다(내 질문 화면은 첫 줄을 쓴다).

## 하지 않는 것 (다음 일)

- 처리 상태(카드로 만듦 · 반려 · 보류)와 처리 API — 상태 칸 Flyway 가 필요하고, 화면 버튼과 함께 정한다.
- 후보에서 만든 카드와 후보 잇기, 같은 이슈 이름 묶기.
- 운영 요약(`/v1/admin/overview`)의 쌓인 건수에 후보 수 넣기.
