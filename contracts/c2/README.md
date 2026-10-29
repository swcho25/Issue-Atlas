# C2 API 응답 계약 v0.1 초안

주는 쪽: backend(P7) → 받는 쪽: frontend(S1·S2·S4). 화면팀이 백엔드 구현을 기다리지 않고 개발할 수 있게 API 5종의 요청·응답 모양과 예시를 고정한다.
성공 응답만 정한다. 오류는 [공통 HTTP 오류](../http-errors/README.md)(`application/problem+json`)를 그대로 쓴다.

| 파일 | 내용 |
| --- | --- |
| `openapi.yaml` | 경로·파라미터·상태 코드. 본문 스키마는 `schemas/` 를 `$ref` |
| `schemas/*.schema.json` | 응답 본문의 원본 (JSON Schema 2020-12). `common.schema.json` 에 공통 enum·형식 |
| `examples/*.json` | 응답 예시. MSW(`mswServer.use`)·Playwright `page.route` 에 그대로 넣는다 |

## 엔드포인트

| # | 메서드·경로 | 화면 | 스키마 | 예시 |
| --- | --- | --- | --- | --- |
| ① | `GET /v1/places` | 지역 선택 | `place-list` | `place-list.json` |
| ② | `GET /v1/places/{place_id}/cards?period_start&period_end` | 이슈 카드 목록 (근거 n/4) | `place-cards` | `place-cards-yeosu.json` |
| ③ | `POST /v1/questions` | 질문 저장 | `question-create-request` · `-response` | `question-create-*.json` |
| ③ | `GET /v1/arguments/{run_id}` | 근거 수요표 + 논증 카드 | `argument` | `argument-*.json` 3개 |
| ④ | `GET /v1/evidence/{evidence_id}` | 원문 탭 · 각주 복사 | `evidence` | `evidence-kosis.json` |
| ⑤ | `GET /v1/observations?place_id&card_id&period_start&period_end` | 지도 점 | `observations` | `observations-a3-yeosu.json` |

## 카드 목록 구현 (S15P31C108-132)

`GET /v1/places/{place_id}/cards`는 로그인한 사용자가 조회한다. `period_start`, `period_end`는 필수 ISO 날짜이며 시작 < 끝, `[start,end)`다. 잘못된 기간은 공통 오류 `400 INVALID_REQUEST`, 없는 지역은 `404 RESOURCE_NOT_FOUND`다.

현재 카드 seed는 C1·A3 두 개다. 카드 목록은 대분류 → 한국어 가나다 → 카드 ID로 고정 정렬하며 확보 수와 무관하다. 네 종류는 statistics·documents·existing_responses·denominators 순서로 각각 한 번씩 반환한다.

상태는 [DB 계약](../database/README.md)의 `card_evidence_status`에서 정확히 같은 지역·조회 기간·카드 버전만 읽는다. 미등록 종류는 `not_collected`다. `available_kinds`는 available 종류 수, `review_pending_count`는 종류별 보류 항목 수의 합이다. 예시 JSON의 가상 확보 상태를 실서비스 seed에 복사하지 않는다. P3/P4의 근거 연결·상태 작성은 후속 작업이며, 연결 전 0/4 응답은 자료가 없다는 판정이 아니라 확보 상태가 등록되지 않았다는 뜻이다.

## 공통 규칙

- 필드 이름은 **snake_case**. PRD 8장·C1과 같은 이름을 쓴다. (화면팀 리뷰에서 camelCase 를 원하면 v0.1 동결 전에 바꾼다)
- 시각은 오프셋이 있는 ISO 8601. 기간은 `period_start`·`period_end` 날짜이며 `[start, end)` — 끝 날짜는 포함하지 않는다.
- 좌표는 GeoJSON `[경도, 위도]`, WGS84.
- 결측은 값 `null` + 사유. 0으로 채우지 않는다.
- **점수·순위·수치 신뢰도 필드는 어떤 응답에도 없다.** 모든 객체가 `additionalProperties: false` 라 추가하면 검증이 실패한다.
- 결과 응답은 `schema_version`(`c2-0.1`), `run_id`, `card_version`, `formula_version`, `taxonomy_version` 을 함께 준다 — 어느 카드 버전·규칙으로 돌린 결과인지 남긴다.
- 문구에 「확산」「전파」「원인」「효과」를 쓰지 않는다.

## 논증 카드 (`argument`)

근거 수요표(`evidence_table`)와 비교 조건(`comparability`) 다음에 6칸이 온다. 칸은 6개뿐이다.

| 칸 | 키 | 작성 주체(`provenance`) |
| --- | --- | --- |
| ① 판단 | `claim` `{value, level, text}` | `rule`·`card` 만 |
| ② 근거 | `data` `{statistics[], documents[], existing_responses[], denominators[]}` | — |
| ③ 보증 | `warrant` `{text}` | 보통 `card` |
| ④ 한정어 | `qualifier` `{grade, components, formula_version}` | `rule`·`card` 만 |
| ⑤ 반박 | `rebuttals[]` `{text, status}` | 근거 유무 판정은 `llm_judgment` 가능 |
| ⑥ 상한선 | `ceiling` `{items[]}` | `rule`·`card` 만 |

스키마가 막는 규칙

| 규칙 | 근거 |
| --- | --- |
| `claim.value` 가 `increasing`·`decreasing` 이면 비교 조건 4개가 모두 `passed: true` | FR-C4 |
| `run_status` 가 `blocked`·`unsupported` 면 `claim.value` 는 `insufficient` | 카드 양식 C6 |
| 지도 점의 `value` 가 `null` 이면 `missing_reason` 필수, 값이 있으면 `null` | PRD 금지 사항 |
| `storage_scope` 가 `link_only` 면 `evidence.display` 는 `null` | FR-E3 |
| `candidate: true` 면 `run_status` 는 `unsupported` | FR-A3 |

## enum

| enum | 값 | 쓰는 곳 |
| --- | --- | --- |
| `evidence_status` | `available` `not_published` `not_collected` `license_blocked` `review_pending` | 근거 **1종**의 상태 (카드 목록·근거 수요표 행) |
| `run_status` | `ready` `partial` `blocked` `unsupported` | 실행 **1건 전체**의 상태 |
| `evidence_kind` | `statistics` `documents` `existing_responses` `denominators` | 근거 4종 |
| `claim` | `observed` `increasing` `decreasing` `unclear` `insufficient` `not_comparable` | 판단 |
| `claim_level` | `observed_fact` `calculated` `associated` `insufficient_evidence` | 판단 수준 |
| `provenance` | `rule` `card` `llm_phrasing` `llm_judgment` `human` | 칸마다 |
| `qualifier_grade` | `high` `medium` `low` (화면: 상·중·하) | 근거 충실도 |
| `rebuttal_status` | `supported` `not_found` `needs_review` | 경쟁 설명 |
| `source_grade` | `A` `B` `C` | 출처 등급 |

PRD 1.2(근거 상태 5가지)와 카드 양식 C6(ready·partial·blocked·unsupported)의 상태가 달랐던 것은 **근거 행 단위**(`evidence_status`)와 **실행 단위**(`run_status`)로 나눠 둘 다 쓴다. 필수 근거가 하나라도 `available` 이 아니면 `blocked`, 선택 근거만 빠지면 `partial`, 카드의 적용 조건(B6)을 못 채우거나 카드가 없으면 `unsupported`.

## 예시 값

| 실제로 받은 값 | 가짜 값 (화면 개발용) |
| --- | --- |
| 지역 코드(옛·새), 측정소 좌표·이름·망, KOSIS 20–24세 순이동(−747·−719·−930), KOSIS 공표일, 통계표 ID | `place_id`·`run_id`·`evidence_id` (실제는 ULID), 15–39세 판정 결과, 보도자료 건수·제목, 측정소 월평균·나쁨 일수, 근거 충실도 구성 값 |

- `argument-a3-not-comparable.json` 의 여천동(여수) 측정소 주소 차이는 실제로 확인한 사실이다(2024 확정자료 vs 현재 측정소 정보). 이전 여부는 아직 모른다.
- 예시끼리 ID를 맞췄다: `argument-c1-ready` 의 통계 근거 `ev_kosis_net_yeosu` → `evidence-kosis.json`.

## 검증 방법

저장소 루트에서 실행한다. 저장소 의존성을 추가하지 않고 pnpm dlx 임시 환경만 쓴다. 공통 스키마를 `-r` 로 함께 넘긴다.

```sh
pnpm --package=ajv-cli@5 --package=ajv-formats@3 dlx ajv validate --spec=draft2020 -c ajv-formats \
  -r contracts/c2/schemas/common.schema.json \
  -s contracts/c2/schemas/argument.schema.json -d "contracts/c2/examples/argument-*.json"
```

스키마마다 `-s`·`-d` 를 바꿔 돌린다(위 엔드포인트 표의 짝). `Cannot find module 'ajv-formats'` 가 나면 [C1 README](../c1/README.md) 「검증 방법」처럼 dlx 캐시의 `ajv-formats` 절대 경로를 `-c` 에 넘긴다.

```sh
pnpm --package=@redocly/cli@1 dlx redocly lint contracts/c2/openapi.yaml
```

실패해야 하는 경우(저장소 밖 임시 파일로 확인): argument 에 `score` 추가, `qualifier.confidence` 추가, 비교 조건 하나가 `false` 인데 `increasing`, `blocked` 인데 `increasing`, 지도 점 `value: null` + `missing_reason: null`.

## 변경 이력

- v0.1 (2026-10-22): 초안. API 5종(엔드포인트 6개) 성공 응답, 예시 9개. 화면팀 리뷰 대기, 10/30 동결 목표.
