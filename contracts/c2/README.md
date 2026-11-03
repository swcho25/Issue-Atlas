# C2 API 응답 계약 v0.1 초안

주는 쪽: backend(P7) → 받는 쪽: frontend(S1·S2·S4). 화면팀이 백엔드 구현을 기다리지 않고 개발할 수 있게 API 5종의 요청·응답 모양과 예시를 고정한다.
성공 응답만 정한다. 오류는 [공통 HTTP 오류](../http-errors/README.md)(`application/problem+json`)를 그대로 쓴다.

| 파일 | 내용 |
| --- | --- |
| `openapi.yaml` | 경로·파라미터·상태 코드. 본문 스키마는 `schemas/` 를 `$ref` |
| `schemas/*.schema.json` | 응답 본문의 원본 (JSON Schema 2020-12). `common.schema.json` 에 공통 enum·형식 |
| `examples/*.json` | 응답 예시. MSW(`mswServer.use`)·Playwright `page.route` 에 그대로 넣는다 |

## 엔드포인트

관리자 카드·지표 저장/검증/승인/버전 API는 [C3 계약](../c3/README.md)과 별도 OpenAPI 초안에 정의한다. 기존 질문/논증 응답 구조는 유지한다. 후보·보류 카드는 일반 목록과 질문 대상에서 제외한다.

| # | 메서드·경로 | 화면 | 스키마 | 예시 |
| --- | --- | --- | --- | --- |
| ① | `GET /v1/places` | 지역 선택 | `place-list` | `place-list.json` |
| ① | `GET /v1/places?parent_id=<시군구>` | 고른 시군구 안의 범위 (읍·면·동) | `place-list` | `place-list-emd-donggu.json` |
| ② | `GET /v1/places/{place_id}/cards?period_start&period_end` | 이슈 카드 목록 (근거 n/4) | `place-cards` | `place-cards-yeosu.json` |
| ③ | `POST /v1/questions` | 질문 저장 | `question-create-request` · `-response` | `question-create-*.json` |
| ③ | `GET /v1/arguments/{run_id}` | 근거 수요표 + 논증 카드 | `argument` | `argument-*.json` 4개 |
| ④ | `GET /v1/evidence/{evidence_id}` | 원문 탭 · 각주 복사 | `evidence` | `evidence-kosis.json` |
| ⑤ | `GET /v1/observations?place_id&card_id&period_start&period_end` | 지도 점 | `observations` | `observations-a3-yeosu.json` |
| 보조 | `GET /v1/sources` | 근거 출처 · 이용 조건 · 마지막 수집 (8장 보조) | `source-list` | `source-list.json` |
| 보조 | `GET /v1/admin/jobs?status&source_id&spec_id&page&size` · `GET /v1/admin/jobs/{job_run_id}` | 관리자 수집 이력 (FR-F5) | `job-list` · `job` | `job-list.json` · `job-failed.json` |

## 카드 목록 구현 (S15P31C108-132)

`GET /v1/places/{place_id}/cards`는 로그인한 사용자가 조회한다. `period_start`, `period_end`는 필수 ISO 날짜이며 시작 < 끝, `[start,end)`다. 잘못된 기간은 공통 오류 `400 INVALID_REQUEST`, 없는 지역은 `404 RESOURCE_NOT_FOUND`다.

현재 카드 seed는 C1·A3 두 개다. 카드 목록은 대분류 → 한국어 가나다 → 카드 ID로 고정 정렬하며 확보 수와 무관하다. 네 종류는 statistics·documents·existing_responses·denominators 순서로 각각 한 번씩 반환한다.

상태는 [DB 계약](../database/README.md)의 `card_evidence_status`에서 정확히 같은 지역·조회 기간·카드 버전만 읽는다. 미등록 종류는 `not_collected`다. `available_kinds`는 available 종류 수, `review_pending_count`는 종류별 보류 항목 수의 합이다. 예시 JSON의 가상 확보 상태를 실서비스 seed에 복사하지 않는다. P3/P4의 근거 연결·상태 작성은 후속 작업이며, 연결 전 0/4 응답은 자료가 없다는 판정이 아니라 확보 상태가 등록되지 않았다는 뜻이다.

## 질문 · 실행 구현 (S15P31C108-133)

`POST /v1/questions` 는 요청마다 질문 하나와 실행 하나를 저장하고 새 `run_id` 를 준다(같은 질문을 다시 보내도 새 실행). 결과는 실행 때 한 번 만들어 `argument_run.result` 에 저장하고, `GET /v1/arguments/{run_id}` 는 그 값을 그대로 준다 — 지난 실행을 다시 계산하거나 덮어쓰지 않는다. 잘못된 기간(시작 ≥ 끝 · 날짜 형식) · 빠진 칸은 `400 INVALID_REQUEST`, 없는 지역 · 카드 · 실행은 `404 RESOURCE_NOT_FOUND`.

| 경우 | `run_status` | 판단 ① 문장 |
| --- | --- | --- |
| `card_id = null` (목록에 없는 질문) | `unsupported`, `candidate: true`, `card_version` · `formula_version` null | 신규 카드 후보로 저장했습니다. 판단하지 않습니다 |
| 필수 근거(통계)가 `available` 아님 | `blocked` | 필수 근거(통계)가 없어 판단하지 않습니다 |
| 카드 판정 규칙이 연결되지 않음 | `unsupported`, `formula_version` null | 이 카드의 판정 규칙이 아직 연결되지 않아 판단하지 않습니다 |
| 규칙 판정 · 선택 근거가 빠짐 | `partial` | 템플릿 (규칙의 claim · 지표 이름) |
| 규칙 판정 · 네 종류 모두 있음 | `ready` | 템플릿 |

- 판단(claim · 비교 조건 · 통계 · 문서 · 분모 근거)은 실행 시 카드 버전의 승인본을 읽어 `rule_id`별 `RuleType`으로 계산한다. C1(`net_migration_trend`)과 A3(`first_last_diff`)를 지원하며, 승인본 없는 legacy 카드는 `unsupported`다. 판단 ① 문장은 승인 `claim_template`의 `{판정값}`에 결과 `label`을 넣는다(예: 「여수시에서 2023–2025 청년(19–39세) 순이동이 청년 순유출 확대.」). 규칙 결과가 증가 · 감소인데 비교 조건이 하나라도 통과가 아니면 실행이 실패한다(고쳐 쓰지 않음). 아직 지원하지 않는 `rule_id`는 판단하지 않는다.
- 필수 근거(통계) 상태: 카드 확보 상태(`card_evidence_status`)가 `not_collected`(등록 없음 포함)면 규칙의 주 지표 월 관측(observation)으로 정한다 — available 한 달이 있으면 `available`, 없고 미공표 달이 있으면 `not_published`. 통계 근거는 실행 때 지역 · 기간 · 지표마다 한 행(`ev_stat_<md5>`)을 만들고, 출처 등급이 없는 출처면 만들지 않는다(기존 대응과 같은 규칙)
- 6칸 문장은 템플릿으로만 만든다(LLM 없음). 보증 ③ · 상한선 ⑥ 은 카드 정의(규칙이 함께 줌), 반박 ⑤ 는 아직 `[]`
- 「기존 대응」: [-136 후보](../existing-response/) 중 같은 카드 · 지역(`place_id`)이고 기간이 겹치는 현재 판만 잇는다. 세출은 회계연도 `[Y-01-01, Y+1-01-01)`, 온통청년은 사업 기간으로 겹침을 본다. 기간을 모르는 후보와 광역 후보(광주 본청 `kr-29` · `place_id` null)는 시군구 질문에 잇지 않는다. 출처 등급(`source.reliability_grade`)이 정해진 출처의 후보만 근거(`evidence`, ID `ev_<후보 해시>`)로 만들고, 등급 없는 후보는 근거 수요표에 `review_pending`(보류 수 = 후보 수)으로만 센다
- 근거 수요표 상태는 `card_evidence_status`(정확히 같은 기간 · 카드 판)를 읽는다. 기존 대응은 이번 실행이 이은 후보가 있으면 그것으로 정한다
- 한정어 ④ 는 위 「정하지 않은 것」의 임시 방식으로 센다

## 그림 자료 `series[]` · 근거 기사 `articles[]`

argument 응답에 「시공간 표시 개발 명세」 5 · 6절의 그림 자료를 싣는다. 판정과 따로, 카드가 있으면 규칙 · 통계 확보 상태와 상관없이 늘 보낸다(카드가 없으면 둘 다 `[]`). 실행 때 [관측 행](../observation/README.md) view 를 읽어 결과와 함께 저장하므로, 지난 실행은 그때 자료 그대로다. 화면은 다시 요청하지 않고 이 응답 하나로 그린다.

| 모양 | 칸 | 그림 |
| --- | --- | --- |
| 통계 | `indicator_id` · `place_id` · `station_id` · `name` · `coordinates`(측정소면 [경도, 위도], 집계 통계면 null) | 측정소 지도(좌표 있음) · 월별 막대(좌표 없음) |
| 이동 | `indicator_id` · `from` · `to` · `to_name` · `from_coordinates`(출발 시군구 대표점) · `to_coordinates`(도착 시도 대표점) | 이동 선 지도 |
| 기사 건수 | `tag` · `place_id` · `name` · `coordinates`, `values` = 그 달 근거 기사 수 | 확산 |

- 공통 칸 `unit` · `periods[]`(`YYYY-MM`, 질문 기간의 달 모두) · `values[]` · `statuses[]`. 세 배열 길이가 같고, `available` 이 아니면 값은 null. 그 달 관측 행이 없으면 `not_collected`. 연으로 묶지 않는다
- 카드에 연결한 지표(명세 7절 그림 순서): C1 = `population_net_migration_19_39`(순이동 막대) → `population_movers`(이동, 도착 시도마다 한 줄), A3 = `air_pm25`(측정소마다 한 줄). 카드가 늘면 카드 ↔ 지표 표로 옮긴다
- `articles[]`: `id`(news_id) · `date`(한국 날짜) · `place_id` · `point` · `precision` · `summary` · `place_name` · `url`(원문 링크 — 빅카인즈 원본 레코드의 언론사 링크, 없으면 null. 본문은 저장하지 않는다). 카드 태그가 있고 질문 지역(앞자리가 같은 읍면동 포함) · 기간 안인 기사. **지금은 기사에 카드 태그가 없어(기사 분류 P4 전) 늘 빈 배열**이고 기사 건수 series 도 나오지 않는다

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
| `qualifier.grade` 는 아래 규칙표와 `components` 가 맞아야 한다 | PRD 7.3 |

## 근거 충실도 규칙표 (`qualifier-0.1`)

한정어(④)의 상·중·하는 가중치 합산이 아니라 이 표로만 정한다(PRD 7.3). 구성 값은 `qualifier.components` 에 모두 담고, 표를 바꾸면 `qualifier.formula_version` 을 올린다. 카드 판정 규칙의 버전(최상위 `formula_version`, 예: `a3-pm25-0.1`)과는 다른 값이다.

| 등급 | 조건 (위에서부터 처음 맞는 것) |
| --- | --- |
| `high` 상 | `a_grade_sources` ≥ 2 그리고 `independent_evidence` ≥ 3 그리고 `latest_within_one_year` = true |
| `medium` 중 | `ab_grade_sources` ≥ 1 그리고 `independent_evidence` ≥ 2 |
| `low` 하 | 그 밖 |

| 구성 값 | 뜻 |
| --- | --- |
| `a_grade_sources` | 근거의 출처 중 출처 등급 A 의 수 |
| `ab_grade_sources` | 근거의 출처 중 출처 등급 A 또는 B 의 수 |
| `independent_evidence` | 독립 근거 수 |
| `latest_observed_at` | 가장 최근 근거의 시점. 근거가 없으면 `null` |
| `latest_within_one_year` | 최신 근거가 분석 기간 말 기준 1년 이내인가. `latest_observed_at` 이 `null` 이면 `false` |

같은 `components` 는 언제나 같은 등급이다. 스키마가 이를 검사한다(등급만 바꾼 응답은 검증 실패). 예시 셋이 한 등급씩이다: `argument-c1-ready` 상 · `argument-a3-not-comparable` 중 · `argument-c1-insufficient` 하.

### 정하지 않은 것 (구성 값을 세는 방법)

PRD 7.3 은 등급 조건만 정했다. 아래는 정해지기 전까지 예시 값이 임시로 따른 방식이며, 실제 계산을 넣기 전에 결정한다.

| # | 결정할 것 | 예시가 임시로 따른 방식 |
| --- | --- | --- |
| 1 | 「독립 근거」를 세는 단위 — 근거 1건 · 출처 1곳 · 같은 원천을 인용한 보도의 처리 | 근거 그룹마다 1건 |
| 2 | 셈에 넣는 근거 그룹 — `denominators[]`(분모·맥락)를 넣는가. 카드 양식 C4 는 「맥락은 판단에 안 쓰고 표시만」 | 넣지 않는다 |
| 3 | 「출처」의 단위 — `source_id` 인가 기관인가 | `source_id` |
| 4 | 「1년 이내」의 경계 — 분석 기간 말(`period_end`, 미포함)에서 365일인가 · 기간 자료는 `observed_period_end` 를 쓰는가 | `period_end` 전 1년 |

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

PRD 1.2(근거 상태 5가지)와 카드 양식 C6(ready·partial·blocked·unsupported)의 상태가 달랐던 것은 **근거 행 단위**(`evidence_status`)와 **실행 단위**(`run_status`)로 나눠 둘 다 쓴다. 필수 근거가 하나라도 `available` 이 아니면 `blocked`, 선택 근거만 빠지면 `partial`, 카드의 적용 조건(B6)을 못 채우거나 카드가 없으면 `unsupported`. 통계 근거가 있어도 승인본 `applicability.min_complete_years`보다 완전한 연 값이 적으면 `unsupported`와 `claim.value = insufficient`를 돌려준다.

## 예시 값

| 실제로 받은 값 | 가짜 값 (화면 개발용) |
| --- | --- |
| 지역 코드(옛·새), 측정소 좌표·이름·망, KOSIS 20–24세 순이동(−747·−719·−930), KOSIS 공표일, 통계표 ID | `place_id`·`run_id`·`evidence_id` (실제는 ULID), 19–39세 판정 결과, 보도자료 건수·제목, 측정소 월평균·나쁨 일수, 근거 충실도 구성 값 |

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

실패해야 하는 경우(저장소 밖 임시 파일로 확인): argument 에 `score` 추가, `qualifier.confidence` 추가, 비교 조건 하나가 `false` 인데 `increasing`, `blocked` 인데 `increasing`, 지도 점 `value: null` + `missing_reason: null`, 구성 값은 그대로 두고 `qualifier.grade` 만 바꾼 argument.

## 변경 이력

- v0.1 (2026-10-22): 초안. API 5종(엔드포인트 6개) 성공 응답, 예시 9개. 화면팀 리뷰 대기, 10/30 동결 목표.
- v0.1 (2026-10-29): 근거 충실도 규칙표 `qualifier-0.1` 추가(S15P31C108-131). `components` 에 `ab_grade_sources` · `latest_within_one_year` 를 더하고, 스키마가 등급과 구성 값이 맞는지 검사한다. 구성 값을 세는 방법 4가지는 미결. 동결 전.
- v0.1 (2026-10-29): 관리자 수집 이력 `GET /v1/admin/jobs` · `/{job_run_id}` 추가(FR-F5). 상태 · 수집 대상(`source_id` · `spec_id`) 필터, 페이지네이션(`page` 1부터, `size` 최대 100). 관리자 전용이라 `/v1/admin/**` 아래에 둔다. 오류 코드 목록에 `UNAUTHORIZED` · `FORBIDDEN` 을 더했다.
- v0.1 (2026-10-30): 출처 목록 `GET /v1/sources` 추가(8장 보조 API). 출처마다 등급 · 이용허락 · 저장 범위와 수집 명세별 마지막 성공 수집 시각. 등급을 아직 정하지 않은 출처는 `source_grade: null`.
- v0.1 (2026-11-01): 지역 목록에 `parent_id` 추가(PRD FR-A1 시 → 구·군 → 읍·면·동). 주지 않으면 지금처럼 시군구 6곳, 시군구 `place_id` 를 주면 그 아래 행정동(`level: emd`, 코드 `sgis` 통합 전 · 뒤 두 줄)을 돌려준다. 없는 지역은 `404 RESOURCE_NOT_FOUND`. 예시 `place-list-emd-donggu.json`(S15P31C108-167).
- v0.1 (2026-11-01): 지역 목록의 시군구 `parent_id` 가 상위 지역(광주 5개 구 `kr-29`, 여수시 `kr-46`)으로 나간다(V0021). 시도는 목록에 없으니 화면은 시군구를 맨 위로 둔다. 예시 `place-list.json` 갱신(S15P31C108-169).
- v0.1 (2026-11-01): 질문 · 실행 구현(S15P31C108-133). argument 의 `question.card_id` · `card_name` · `card_version` · `formula_version` 을 null 허용으로 바꾼다 — 목록에 없는 질문(FR-A3)과 판정 규칙이 없는 카드. `card_id` 가 null 이면 `run_status = unsupported` · `card_version = null` 을 스키마가 검사한다. 예시 `argument-unsupported.json` 추가.
- v0.1 (2026-11-02): 시군구 `place_id` 가 `kr-<KOSIS 새 시군구 5자리>` 로 바뀐다(V0024): 광주 동구 `kr-12210` · 서구 `kr-12240` · 남구 `kr-12270` · 북구 `kr-12300` · 광산구 `kr-12330` · 여수시 `kr-12130`. 옛 `plc_*` 는 404. 예시를 모두 새 ID 로 바꿨다. 측정소 `plc_stn_*` 은 그대로.
- v0.1 (2026-11-03): 측정소 ID(`series[].station_id` · 관측 행 `station_id`)가 `kr-<부모 시군구 5자리>-s<에어코리아 코드>` 로 바뀐다(V0032): `plc_stn_336121` → `kr-12130-s336121`. 예시를 새 ID 로 바꿨다. 옛 `plc_stn_*` 는 404
- v0.1 (2026-11-02): argument 에 `series[]`(그림 자료: 통계 · 이동 · 기사 건수 세 모양) · `articles[]`(근거 기사)를 더한다 — 「시공간 표시 개발 명세」 5 · 6절. 둘 다 필수 칸이고 카드가 없으면 빈 배열. 예시 4개에 추가(여수 C1 · A3 는 로컬 실데이터 값).
- v0.1 (2026-11-02): `articles[]` 에 `url`(원문 링크, null 허용)을 더한다 — 데모 「근거 기사 2클릭 → 원문」. C1 예시 문구의 청년 연령을 카드 계약(contracts/cards, 대표 결정 2026-11-01)대로 15–39세 → 19–39세.
- v0.1 (2026-11-02): C1 판정 규칙 연결(`c1-net-migration-0.1`, 대표 결정 2026-11-01). 통계 상태가 등록되지 않았으면 관측 행으로 정하고, 통계 근거를 실행 때 만든다. 판단 문장은 카드 결과 이름(`rule.outcomes[].label`)을 쓴다.
