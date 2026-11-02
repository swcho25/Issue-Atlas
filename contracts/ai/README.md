# AI 모듈 입력 v0.1.1 초안

AI 모듈(P4 카드 분류 · P5 논증 문장)이 받는 입력 두 가지와, backend 에 알릴 처리 상태.
주는 쪽: 정제(P2) · 지역 · 시간(P3) · 규칙 엔진(P5) → 받는 쪽: AI 모듈(P4 · P5) · backend(P7).
계약 변경은 박준우(P2) · 정우현(P3) · 장성우(P7) 리뷰가 필요하다. **아직 실제 연동은 없다** — 예시는 모두 가상(`fixture: true`)이고, 샘플 요청 목록은 요청할 실제 문서의 목록일 뿐 추출 결과가 아니다.

| 파일 | 내용 |
| --- | --- |
| `document-input.schema.json` | 문서 입력 — 문서 1건 (카드 분류 · 근거 연결용) |
| `judgment-input.schema.json` | 판정 입력 — 실행 1건의 통계 · 규칙 판정 결과. 칸 모양은 [C2](../c2/) argument 를 `$ref` 로 쓴다 |
| `status.schema.json` | 처리 상태 — backend 공유용. `output` 모양은 아직 정하지 않았다 |
| `examples/` | 가상 입력 · 상태 예시 (아래 「예시」) |
| `samples/` | P3 에 요청할 실제 문서 목록 (본문 없음) |

## 문서 입력 (`document-input`)

| 칸 | 뜻 | 가져오는 곳 |
| --- | --- | --- |
| `doc_id` | 판이 바뀌어도 같은 ID. 기사 `bigkinds:<news_id>`(C1 `dedup_key`), 보도자료 `press:<press_id>` | C1 · `press_release` |
| `version` | `content_hash`(원본 판) · `refine_rule_version`(P2 `rule_version`) · `extraction_version`(P3 규칙 판) | P2 · P3 |
| `content` | `kind` · `title` · `summary` · `body` · `excerpt` · `categories` · `keywords` · `entities` | C1 `document`, `summary` 는 P3 |
| `extraction_status` | `done` P3 추출 끝 / `pending` 아직 | P3 |
| `regions[]` | 지역 배열. 항목마다 `sido` · `sigun` · `gu` · `place_id` · `raw` · `source` · `status` | P3 `news_event`, 원천 메타 |
| `event_period` | 사건 · 관측 기간 `{start, end, precision}`, `[start, end)` | P3 `event_start` · `event_end` · `time_precision` |
| `published_at` · `published_precision` | 게시 시각 · `time`(시각까지) / `day`(날짜만, 그날 0시로 적음) | C1 `published_at` · `press_release.published_on` |
| `source` | `source_id` · `publisher` · `link`(원문 페이지) · `raw_url`(받아 온 곳) · `locator`(원문 위치) | C1 · `press_release` |
| `usage` | `license_type` · `storage_scope` | P2 이용허락 표 |
| `fixture` | 가상 자료면 true | — |

`regions[]` 항목의 `source` 와 `status`

| source | 뜻 | status |
| --- | --- | --- |
| `extraction` | P3 가 정한 지역. `sido` 는 늘 있고(`news_event.sido` NOT NULL) `raw` 는 null | `confirmed` (P3 가 후보로 낼 때만 `candidate`) |
| `publisher` | 발행 기관의 지역. 보도자료 `place_code_raw`(여수시 `46130`, 광주광역시 `29`)를 `raw` 에 그대로 | 늘 `candidate` |
| `source_meta` | 원천이 준 개체명(빅카인즈 `entities.locations`)을 `raw` 에 그대로 | 늘 `candidate` |

`extraction` 항목은 하나다(스키마가 검사). 여러 지역에 걸친 글은 P3 가 넓은 단위 하나로 낸다 — 예: 광주 · 여수 기사는 `sido = 전남광주통합특별시`, `sigun` · `gu` null. P3 「지역 맞추기」에서 시도 전체 기사(`sigun` null)는 그 시도의 모든 시군구에 함께 나오므로 어느 지역 카드에서도 빠지지 않는다. 넓은 단위 기사를 근거로 쓸지는 카드 규칙이 정한다. 배열인 것은 `candidate` 힌트를 같이 담기 위해서다.

`candidate` 는 힌트일 뿐이다. 카드 근거의 지역 맞추기([P3 계약](../p3/) v0.1 「지역 맞추기」)에는 `confirmed` 만 쓴다. 이 계약은 지명 · 코드를 지역으로 바꾸지 않는다(P3 몫).

### 빈 칸의 뜻

| 칸이 비면 | `extraction_status = done` | `extraction_status = pending` |
| --- | --- | --- |
| `regions = []` | 생기지 않는다 (P3 는 시도를 늘 채움 — 스키마가 막음) | 지역 힌트도 없음 → 분류는 하되 지역 맞추기에서 빠짐 |
| `regions` 에 `confirmed` 없음 | 생기지 않는다 | 지역 미확정 → 근거로 쓰지 않고 P3 를 기다린다 (`WAITING_EXTRACTION`) |
| `event_period = null` | 글에 사건 날짜가 없다 (P3 `time_precision = published`). **게시일로 채우지 않는다** — 기간 맞추기에서 「시점 모름」 | 아직 추출 안 함 |
| `event_period.end = null` | 한 시각의 사건 | — |
| `summary = null` | P3 요약 실패 → 제목 · 본문으로 분류 | 아직 추출 안 함 |

| 칸이 비면 | 뜻 |
| --- | --- |
| `body = null` | 본문 없음(`storage_scope` 가 `metadata` · `link_only`). 제목 · 메타만으로 분류하고, 카드에서는 「본문 미확인」으로 표시. 기사는 요약 뒤 본문을 지우므로([기사 계약](../article/README.md) v0.3) 늘 null 이 된다 — 제목 · 요약으로 분류하고 「본문 미확인」으로 표시하지 않는다 |
| `excerpt = null` | 앞부분 없음. 뉴스와 `link_only` 는 늘 null |
| `publisher = null` | 원천이 언론사 · 기관을 주지 않음 |
| `link = null` | 원문 페이지 주소를 쓸 수 없음 (본문도 없다) |
| `source_id = null` | C1 출처 목록에 없는 원천 — 지금은 보도자료(C1 연동 전) |
| `version.content_hash = null` · `refine_rule_version = null` | 원본 장부 · P2 를 거치지 않음 — 지금은 보도자료. 같은 `doc_id` 의 판을 구분하지 못한다 |
| `version.extraction_version = null` | P3 규칙 판이 기록되지 않음 (P3 v0.1 에 판 칸이 없다) |
| 배열 `[]` (`categories` · `keywords` · `entities.*`) | 원천이 주지 않음. 수집기 · AI 가 채워 넣지 않는다 |

**본문은 내부 분석(분류 · 관련 문장 찾기)에만 쓴다.** AI 출력 · 카드 · API 에 본문을 옮기지 않는다([기사 계약](../article/) 이용 규칙).

### P3 `news_event` 에서 옮기는 규칙

기준은 [P3 계약](../p3/) v0.1 · Flyway V0016. P3 칸 이름이 바뀌면 이 표를 고친다.

| `news_event` | 문서 입력 |
| --- | --- |
| 행 있음 | `extraction_status = done` |
| `sido` · `sigun` · `gu` · `place_id` | `regions[]` 의 `extraction` 항목 하나 (`status = confirmed`) |
| `summary` | `content.summary` |
| `time_precision` 이 `minute` · `day` · `month` | `event_period = {start: event_start, end: event_end, precision}` |
| `time_precision = published` | `event_period = null` |
| 행 없음 | `extraction_status = pending` |

## 판정 입력 (`judgment-input`)

규칙 엔진이 끝낸 값이다. **AI 는 아래 칸을 바꾸지 않는다.** 문장을 쓸 때 숫자는 `statistics_points` 에 있는 값만 쓴다.

| 칸 | 모양 | 비고 |
| --- | --- | --- |
| `run_id` · `question` · `card_version` · `formula_version` · `taxonomy_version` · `run_status` | C2 와 같음 | |
| `evidence_table` · `comparability` · `claim` · `qualifier` · `data` · `warrant` · `ceiling` | C2 와 같음 | C2 의 스키마 규칙(blocked → insufficient, 증가 · 감소면 비교 조건 모두 통과, 한정어 등급 규칙표)을 그대로 검사 |
| `statistics_points[]` | `{evidence_id, indicator_id, unit, place_id, period_start, period_end, value, missing_reason, is_provisional}` | 값이 null 이면 `missing_reason` 필수, 값이 있으면 null. 0 으로 채우지 않는다. 필수 근거가 없으면 빈 배열 |
| `excluded_provisional[]` | 판단에서 뺀 잠정값의 식별자(관측값은 C1 `dedup_key`) | 상한선에 적는다 |
| `rebuttal_candidates[]` | `{text, decided_by_rule}` | 카드가 정한 경쟁 설명. `decided_by_rule` 이 null 인 것만 AI 가 문서로 근거 유무를 본다 |

## 처리 상태 (`status`) — backend 공유용

| `status` | `reason_code` | 뜻 | `retryable` |
| --- | --- | --- | --- |
| `done` | null | 결과 있음 (`output`) | — |
| `waiting_input` | `WAITING_REFINE` · `WAITING_EXTRACTION` · `WAITING_JUDGMENT` | 입력이 아직 없음: P2 정제 · P3 추출 · 규칙 판정 전 | true |
| `skipped` | `RUN_BLOCKED` · `RUN_UNSUPPORTED` | 실행이 blocked · unsupported 라 AI 를 부르지 않음. 카드에는 규칙 문장만 | false |
| `failed` | `INPUT_INVALID` | 입력이 이 스키마를 어김 | false |
| | `FIXTURE_IN_PRODUCTION` | `fixture: true` 입력이 운영에 들어옴 | false |
| | `LLM_TIMEOUT` · `LLM_ERROR` | 모델 호출 실패 | true |
| | `OUTPUT_REJECTED` | 출력 검사(숫자 · 금지어 · 근거 구절이 원문에 있는지)에서 떨어짐. 다시 돌리지 않고 검수로 보낸다 | false |

`task` 는 `classify_document`(입력 `doc_id`) · `write_argument`(입력 `run_id`). `output` 모양은 v0.2 에서 정한다.

## 예시 · 샘플

`examples/` 는 모두 가상이다(`fixture: true`, 제목은 `[fixture]` 로 시작 — 스키마가 검사, 링크는 `example.com`).

| 파일 | 경우 |
| --- | --- |
| `doc-news-confirmed.json` | 기사 · 본문 있음 · 지역 확정 · 사건 날짜 있음 |
| `doc-press-metadata.json` | 보도자료 · 본문 없음 · 추출 전 · 발행 기관 지역 후보만 |
| `doc-news-region-candidate.json` | 기사 · 시군(광주)까지만 확정, 구는 원천 개체명 후보 |
| `doc-news-no-event-date.json` | 기사 · 글에 사건 날짜 없음 (`event_period = null`) |
| `judgment-ready.json` | 성공 — C2 `argument-c1-ready` 와 같은 값 + 가상 19–39세 순이동 |
| `judgment-insufficient.json` | 자료 부족 — C2 `argument-c1-insufficient`, 필수 통계 미공표 |
| `judgment-not-comparable.json` | 비교 불가 — C2 `argument-a3-not-comparable` + 가상 여천동(여수) PM2.5 |
| `status-done.json` · `status-waiting-input.json` · `status-failed.json` | 처리 상태 |

판정 예시의 근거 수요표 · 비교 조건 · 판단 · 한정어는 C2 예시를 그대로 옮겼다. `statistics_points` 의 값은 가상이다.

`samples/` 는 실제 문서다(`fixture: false`). **본문은 넣지 않는다.**

| 파일 | 내용 |
| --- | --- |
| `real-article-requests.json` | 빅카인즈 기사 10건 — 여수 3 · 광주 3 · 광주·전남 2 · 전남 1 · 범위 밖(울산) 1. 임베딩 평가에서 본문을 직접 읽고 지역 범위를 판정한 20건(D01–D20)에서 골랐다. 항목마다 확인할 점(`check`) |
| `metadata-document-requests.json` | 보도자료 5건 — 여수시 3 · 광주광역시 2. 여수시는 게시판 목록 첫 쪽(2026-10-30), 광주광역시는 로컬 DB `press_release` 의 분석 기간(2023–2025) 안 행에서 고름. 빅카인즈 기사는 본문이 없으면 P2 가 보류(`BODY_MISSING`)해 다음 단계로 오지 않으므로, 지금 `metadata` 로 들어오는 문서는 보도자료뿐이다 |

## 검증

`pnpm engine:test` 가 `engine/tests/test_ai_input_contract.py` 로 예시 전부를 스키마로 검사하고, 일부러 틀린 입력이 실패하는지 본다. ajv 로도 확인할 수 있다(C2 스키마를 `-r` 로 함께 넘긴다. `ajv-formats` 를 못 찾으면 [C1 README](../c1/README.md) 「검증 방법」).

```sh
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats \
  -s contracts/ai/document-input.schema.json -d "contracts/ai/examples/doc-*.json"
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats \
  -r contracts/c2/schemas/common.schema.json -r contracts/c2/schemas/argument.schema.json \
  -s contracts/ai/judgment-input.schema.json -d "contracts/ai/examples/judgment-*.json"
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats \
  -s contracts/ai/status.schema.json -d "contracts/ai/examples/status-*.json"
```

## 열린 문제

- 보도자료의 지역 · 시간 추출과 C1 연동이 없다(P3 · P1). 그 전까지 보도자료는 늘 `pending`
- P3 `news_event` 에 규칙 판 칸이 필요하다. 없으면 P3 규칙이 바뀐 뒤 어느 기사를 다시 분류할지 알 수 없다(P3 계약 「아직 없는 것」, P3 가 넣는다). 생기면 `version.extraction_version` 으로 받고, 그 전까지는 null
- 외부 LLM 에 실제 기사 본문을 보내도 되는지는 기업 계약 확인 전이다. 확인 전에는 가상 · 합성 자료만 외부 모델로 보낸다
- 카드 정의(경쟁 설명 · 상한선 · 적용 조건)의 명세(card-0.1)는 저장소 밖 초안이다. 판정 입력은 결과에 담긴 값만 받는다
- 출력(`output`) 모양 · 출력 검사 규칙

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1.1 | 2026-11-02 | 기사 `body = null` 의 뜻: 요약 뒤 지운 본문 — 제목 · 요약으로 분류 (S15P31C108-189) |
| v0.1 초안 | 2026-10-30 | 문서 입력 · 판정 입력 · 처리 상태 스키마, 빈 칸의 뜻, 가상 예시 10개, 실제 문서 샘플 요청 목록 2개 (S15P31C108-153) |
