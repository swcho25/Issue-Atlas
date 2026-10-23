# P2 정제 레코드 v0.1

정제(P2) → 지역·시간(P3) · 분류(P4). 만드는 곳: `engine/pipeline/refine/` (`refine_records`).
계약 변경은 받는 쪽 정우현(P3)·최동준(P4) 리뷰가 필요하다.

## 모양

정제 레코드 = **C1 레코드 칸**([C1](../c1/)) + **P2 칸** 5개. [refined-record.schema.json](refined-record.schema.json)은 P2 칸만 본다.

- C1 칸: P2 가 고치는 것은 `storage_scope` · `value` · `missing_reason`(저장 범위 게이트), `value`(소수점 표현 오차), `raw_url`(API 키를 `<KEY>` 로) 뿐이다. P1 이 채운 시간·공간 칸은 그대로 넘긴다
- `pass` · `fixed` 레코드의 C1 칸은 C1 스키마를 그대로 통과한다. `held` 는 C1 을 어긴 채 보관될 수 있으니 다음 단계로 넘기지 않는다
- `run_id` · `collected_at` 은 그 값을 마지막으로 확인한 수집 실행이다(재수집이면 최신 실행). 원본(`raw_record`)은 처음 받은 실행에 남으므로, 원본은 `run_id` 가 아니라 `content_hash` 로 찾는다

## 수집기 입구 검사

수집기(P1)가 원본을 저장하기 전에 쓸 검사는 `pipeline.refine.validate` 하나다. 필수 칸 · 금지 소스 · URL 속 API 키 · C1 형식만 보고, 걸리면 원본으로도 남기지 않는다.
이용허락·저장 범위·중복(`LICENSE_UNKNOWN` · `SCOPE_DOWNGRADED` · `DEDUP_KEY_CONFLICT` 등)은 원본을 저장한 뒤 P2 정제가 판정한다. 입구에서 `refine_record(s)` 결과로 막으면 P2 규칙이 바뀔 때 수집이 멈추고 원본이 사라진다.

| 칸 | 타입 | 뜻 |
| --- | --- | --- |
| `validation_status` | `pass` / `fixed` / `held` | 문제 없음 / P2 가 고쳐서 넘김 / 보류(다음 단계로 안 넘김) |
| `issues` | `{code, field}` 배열 | 사유. `pass` 면 빈 배열 |
| `rule_version` | `p2-…` | 정제 규칙 판. 같은 입력 + 같은 판이면 같은 출력(바이트 단위) |
| `obs_key` | `obs:<sha256 64자리>` 또는 null | 원천의 같은 칸(source_id · spec_id · locator). 판(수정본)이 달라도 같다. 관측값이 아니면(indicator_id 없음) null |
| `is_latest` | bool 또는 null | 같은 `obs_key` 중 보류가 아닌 가장 늦은 판(published_at, 없으면 collected_at). 이전 판은 지우지 않고 false 로 남긴다. `obs_key` 가 null 이면 null |

## 사유 코드

| 코드 | 상태 | 언제 |
| --- | --- | --- |
| `MISSING_REQUIRED` | held | 필수 칸이 없거나 비었음. `raw_url\|file_name` · `value\|missing_reason` 처럼 묶음이면 field 에 `\|` |
| `INVALID_VALUE` | held | C1 스키마의 허용값·형식·조건 규칙 위반 |
| `UNKNOWN_FIELD` | held | C1 에 없는 칸 |
| `FORBIDDEN_SOURCE` | held | 네이버 · 카카오 · 빅카인즈 주소 (PRD 7.5) |
| `SECRET_IN_URL` | held | URL 쿼리에 실제 API 키. 출력 raw_url 은 `<KEY>` 로 가림 |
| `LICENSE_UNKNOWN` | held | 이용허락 표(`engine/pipeline/refine/license_scopes.json`)에 없는 license_type |
| `DEDUP_KEY_CONFLICT` | held | 같은 dedup_key 인데 수집 실행 칸(`collected_at` · `run_id` · `collector_version`) 말고 다른 칸이 다른 레코드가 함께 옴. 수집 실행 칸만 다르면 재수집으로 보고, 마지막으로 확인한 것(`collected_at` 이 가장 늦은 것, 같으면 `run_id` 가 큰 것) 하나만 내보냄 |
| `SCOPE_DOWNGRADED` | fixed | P1 의 storage_scope 가 이용허락보다 넓어 낮춤 |
| `VALUE_STRIPPED_BY_SCOPE` | fixed | 저장 범위가 full 이 아닌 관측값이라 value 를 지우고 missing_reason 을 license_blocked 로 |

`fixed` 사유만 있으면 `fixed`, 그 밖의 사유가 하나라도 있으면 `held`.

## 검증

engine 테스트(`pnpm engine:test`)가 C1 계약 예시를 정제한 결과를 이 스키마와 C1 스키마로 검사한다. 사유 코드를 새로 만들면 이 스키마의 `code` 목록과 이 표, `engine/tests/test_refine_output_schema.py` 의 코드별 예시를 같이 고친다.

## 아직 없는 것

- 문서 레코드(뉴스 · 보도자료)용 칸 — C1 에 문서 칸이 생기면 같이 정한다
- 전재 묶음 칸(`syndication_group_id` 등)

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-22 | 초안: P2 칸 5개, 사유 코드 9개, 상태 규칙 (S15P31C108-79) |
| v0.1.1 | 2026-10-23 | 재수집(수집 실행 칸만 다름)은 충돌이 아니라 반복으로 보고 마지막으로 확인한 것을 내보냄. 스키마는 그대로 (S15P31C108-88) |
| v0.1.2 | 2026-10-23 | 문구: run_id 는 마지막 확인 실행이고 원본은 content_hash 로 찾음, 수집기 입구 검사는 `validate` 만. 스키마·정제 동작은 그대로 (S15P31C108-89) |
