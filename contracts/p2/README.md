# P2 정제 레코드 v0.5

정제(P2) → 지역·시간(P3) · 분류(P4). 만드는 곳: `engine/pipeline/refine/` (`refine_records`). DB 에 저장한 결과는 아래 「저장」, 에어코리아 확정 시간값은 「월별 집계」에만 저장한다.
계약 변경은 받는 쪽 정우현(P3)·최동준(P4) 리뷰가 필요하다.

## 모양

정제 레코드 = **C1 레코드 칸**([C1](../c1/)) + **P2 칸** 5개. [refined-record.schema.json](refined-record.schema.json)은 P2 칸만 본다.

- C1 칸: P2 가 고치는 것은 `storage_scope` · `value` · `missing_reason` · `document.body`(저장 범위 게이트), `value`(소수점 표현 오차), `raw_url`(API 키를 `<KEY>` 로) 뿐이다. P1 이 채운 시간·공간 칸은 그대로 넘긴다
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
| `obs_key` | `obs:<sha256 64자리>` 또는 null | 원천의 같은 칸(source_id · spec_id · locator). 판(수정본)이 달라도 같다. 관측값(indicator_id 있음)과 문서(document 있음)에 붙고, 측정소 메타처럼 둘 다 아니면 null. 문서는 원천 문서 하나(빅카인즈 `locator.news_id`)가 한 칸이라 같은 기사를 다시 받은 행이 같은 키다 |
| `is_latest` | bool 또는 null | 같은 `obs_key` 중 보류가 아닌 판 하나. 관측값은 가장 늦은 판(published_at, 없으면 collected_at), 문서는 본문이 있는 판이 먼저이고 같으면 가장 늦게 받은 판(collected_at). 이전 판은 지우지 않고 false 로 남긴다. `obs_key` 가 null 이면 null |

## 사유 코드

| 코드 | 상태 | 언제 |
| --- | --- | --- |
| `MISSING_REQUIRED` | held | 필수 칸이 없거나 비었음. `raw_url\|file_name` · `value\|missing_reason` 처럼 묶음이면 field 에 `\|`. 문서(`place_code_system = source_text`)는 원천이 지명을 주지 않으면 `place_code_raw = ""` 가 맞으므로 빈 문자열을 누락으로 보지 않는다(키가 없거나 null 이면 누락) |
| `INVALID_VALUE` | held | C1 스키마의 허용값·형식·조건 규칙 위반 |
| `UNKNOWN_FIELD` | held | C1 에 없는 칸 |
| `FORBIDDEN_SOURCE` | held | 네이버 · 카카오 주소 (PRD 7.5). 빅카인즈는 언론 기사 수집원으로 쓰기로 해 금지에서 뺐다 (노션 결정 2026-10-26) |
| `SECRET_IN_URL` | held | URL 쿼리에 실제 API 키. 출력 raw_url 은 `<KEY>` 로 가림 |
| `LICENSE_UNKNOWN` | held | 이용허락 표(`engine/pipeline/refine/license_scopes.json`)에 없는 license_type. 빅카인즈 기사는 `BIGKINDS-이용약관` (최대 `full`: 본문 저장, 팀 결정 2026-10-28. 본문은 내부 분석(요약 · 분류)에만 쓰고 화면 · API 로 내보내지 않는다) |
| `DEDUP_KEY_CONFLICT` | held | 같은 dedup_key 인데 수집 실행 칸(`collected_at` · `run_id` · `collector_version`) 말고 다른 칸이 다른 레코드가 함께 옴. 수집 실행 칸만 다르면 재수집으로 보고, 마지막으로 확인한 것(`collected_at` 이 가장 늦은 것, 같으면 `run_id` 가 큰 것) 하나만 내보냄 |
| `SCOPE_DOWNGRADED` | fixed | P1 의 storage_scope 가 이용허락보다 넓어 낮춤 |
| `VALUE_STRIPPED_BY_SCOPE` | fixed | 저장 범위가 full 이 아닌 관측값이라 value 를 지우고 missing_reason 을 license_blocked 로 |
| `BODY_STRIPPED_BY_SCOPE` | fixed | 저장 범위가 full 이 아닌 문서라 `document.body` 를 null 로 (C1 v0.2: full ⇔ 본문 있음). field 는 `document` |

`fixed` 사유만 있으면 `fixed`, 그 밖의 사유가 하나라도 있으면 `held`.

## 검증

engine 테스트(`pnpm engine:test`)가 C1 계약 예시를 정제한 결과를 이 스키마와 C1 스키마로 검사한다. 사유 코드를 새로 만들면 이 스키마의 `code` 목록과 이 표, `engine/tests/test_refine_output_schema.py` 의 코드별 예시를 같이 고친다.

## 저장 — `normalized_record`

만드는 곳: `python -m pipeline.refine --db` (`engine/pipeline/refine/store.py`). 테이블은 Flyway [V0005](../../backend/src/main/resources/db/migration/V0005__create_normalized_record.sql).

- 입력은 **장부** `raw_record.c1_record` 다. 장부는 수집기(P1)가 원본에서 만든 C1 레코드로, P1 이 원본과 같은 행에 저장한다. **P2 는 장부를 만들지 않고 읽기만 한다.**
- **관측 일 묶음으로 나눠 정제한다.** 묶음은 장부의 `observed_period_start`(없으면 `observed_at`) 앞 10자(`YYYY-MM-DD`, 적힌 시간대 그대로의 날짜)이고, 시각이 없거나 그 모양이 아니면 `''` 한 묶음이다. 메모리에는 한 번에 한 묶음만 올리고, 저장은 묶음마다 커밋한다. 실행 결과의 `buckets` 가 묶음 수다
  - 최신본은 같은 `obs_key` 끼리, 반복 · 충돌은 같은 `dedup_key` 끼리만 보므로 결과는 전체를 한 번에 정제한 것과 같다. 같은 `dedup_key` 나 같은 관측 칸(`obs_key` 재료: source_id · spec_id · locator)이 여러 묶음에 갈라지면(예: 시각이 깨진 장부) 그 레코드는 모두 한 묶음(`~`)으로 모아 함께 정제한다
  - 같은 측정값의 판 · 재수집본은 시각 표기(시간대 포함)가 같아야 같은 묶음에 든다. 다르면 위 규칙으로 모은 묶음에 가서 결과는 같지만 그 묶음이 커진다
- 장부가 없는 원본(`c1_record` 가 null — 이 칸이 생기기 전에 저장된 원본 포함)은 건너뛰고 실행 결과의 `skipped` 에 source_id 별로 센다
- 장부의 `content_hash` 가 그 행의 원본과 다르면 `C1_HASH_MISMATCH` 로 멈춘다. 이 검사는 정제 전에 전체 장부에 한 번 해서, 어느 묶음도 저장하지 않고 멈춘다
- **원본 한 행 = 정제 한 행.** `content_hash` 가 UNIQUE 이고 `raw_record.content_hash` 를 가리킨다. 같은 `dedup_key` 라도 원본이 다르면(충돌) 각자 held 로 남는다. **단, 에어코리아 확정 시간값은 정제 행으로 저장하지 않는다** — 아래 「월별 집계」
- 저장된 행의 `run_id` · `collected_at` 은 장부 값을 따른다. 재수집 때 P1 이 장부를 갱신하지 않으면 원본을 처음 저장한 실행이다(위 「모양」의 「마지막으로 확인한 실행」은 장부가 그렇게 채워질 때만 맞다)
- 같은 장부 · 같은 `rule_version` 으로 다시 돌리면 아무 행도 바뀌지 않는다. 결과가 바뀐 행(예: 새 판이 들어와 `is_latest` 가 false 가 된 이전 판)만 `refined_at` 이 새로 찍힌다

| 칸 | 뜻 |
| --- | --- |
| `content_hash` | 원본 찾기 (`raw_record` FK) |
| `dedup_key` | 장부 값 그대로 |
| `source_id` · `spec_id` | 원본 행(`raw_record` · `source_spec`)의 값 |
| `indicator_id` · `place_code_system` · `place_code_raw` · `observed_period_type` · `observed_period_start` · `observed_period_end` · `observed_at` · `value` · `unit` · `missing_reason` · `storage_scope` | C1 칸. **held 면 비운다** (C1 을 어길 수 있다) |
| `validation_status` · `issues` · `rule_version` · `obs_key` · `is_latest` | P2 칸 (위 표) |
| `record` | 정제 레코드 전체(C1 칸 + P2 칸, jsonb). 위 칸은 모두 여기서 꺼낸 값이다 |
| `refined_at` | 이 행의 결과가 마지막으로 바뀐 시각 |

**다음 단계가 읽는 곳은 `normalized_ready` 뷰다.** `validation_status` 가 pass·fixed 이고 `is_latest` 가 false 가 아닌 행 — 관측값은 최신본만, 문서는 원천 문서 하나에 1건(본문 있는 판 먼저), `is_latest` 가 null 인 메타 레코드는 모두. 이 조건을 각자 다시 쓰지 않는다.

## 월별 집계 — `air_monthly`

에어코리아 확정 시간값의 측정소 × 지표 × 월(한국 시각) 표. Flyway [V0008](../../backend/src/main/resources/db/migration/V0008__create_air_monthly.sql) · [V0009](../../backend/src/main/resources/db/migration/V0009__store_air_monthly_only.sql).
**에어코리아 확정 시간값(`source_id = 'airkorea_final'`)은 `normalized_record` 에 저장하지 않고 이 표에만 저장한다**(v0.4). 시간 단위 정제 결과는 행당 약 2.4KB 라 3년 치(약 347만 행)면 약 8GB 인데, 카드 · P3 · P4 는 월 값을 쓴다. 원본(`raw_record`)은 시간 단위 그대로 남으므로 월평균의 근거는 원본으로 따라간다(측정소 코드 · 기간으로 `raw_record.c1_record` 를 찾는다).

- **검증은 시간마다 그대로 한다.** 하루 묶음으로 정제하면서 결측 · 충돌 · 잠정/확정 판을 시간마다 판정하고, 보류가 아닌 최신본만 월 합계에 더한다. 확정 자료가 잠정 자료를 대신하면 확정 값만 센다
- **월은 한국 시각으로 자른다.** 원천 「1월 31일 24시」(31일 23–24시)는 1월이다
- **`refine --db` 가 모든 묶음을 정제한 뒤 이 표를 한 번에 다시 쓴다**(한 트랜잭션, 쓰는 동안 읽는 쪽은 이전 값을 본다). 정제가 중간에 멈추면 이전 값이 그대로 남으니 다시 돌린다. 실행 결과의 `air_monthly` 가 행 수, `air_unplaced` 가 측정소 · 지표 · 시간을 읽을 수 없어 어느 달에도 넣지 못한 레코드 수다. 같은 지표의 단위가 한 달 안에서 다르면 `AIR_UNIT_MISMATCH` 로 멈춘다
- 한 행 = (`station_code`, `indicator_id`, `month_start`). 기본 키

| 칸 | 뜻 |
| --- | --- |
| `station_code` · `station_name` | 측정소 코드(장부 `place_code_raw`) · 이름(원천 locator 의 측정소명, 그 달에 바뀌었으면 사전순 뒤의 것) |
| `indicator_id` · `unit` | `air_pm10` · `air_pm25` · `air_o3` · `air_no2` · `air_co` · `air_so2`, 단위(µg/m³ · ppm) |
| `month_start` · `month_end` | 한국 시각 [1일 0시, 다음 달 1일 0시). KOSIS 월 자료의 `observed_period_start` 와 같은 값이라 바로 잇는다 |
| `month_hours` | 그 달 시간 수(날짜 수 × 24) |
| `valid_hours` | 값이 있는 시간 수. 결측(−999 · 빈칸, `value` null)은 세지 않는다 |
| `held_hours` | 쓸 수 있는 판 없이 보류(held)만 있는 시간 수. 보류 사유는 원본을 다시 정제해야 볼 수 있다 |
| `value_mean` | 유효 시간값의 산술평균. **`valid_hours` 가 `month_hours` 의 75% 미만이면 null** |
| `value_min` · `value_max` | 유효 시간값의 최솟값 · 최댓값 (75% 와 상관없이) |
| `has_provisional` | 그 달에 잠정 자료(`is_provisional`)가 한 시간이라도 최신본이면 true |

- 75% 는 대기 통계에서 흔히 쓰는 기준으로 우선 정했다. 공식 기준을 확인하면 고친다
- 확인(2026-10-27): 2024-01 광주 서석동(324115) · 농성동(324121) 6항목의 일평균을 같은 방식(한국 시각 하루 유효 시간 평균)으로 내면 에어코리아 「측정소별 확정자료 조회」 일평균 372개와 모두 같다. 월평균(시간 평균)은 공개 일평균의 평균과 반올림 범위에서 같고, 결측 시간이 있는 날만큼 조금 다르다(예: 농성동 PM10 29.8 · 30.0)
- 시군구 단위 평균은 없다. 측정소 ↔ 시군구 연결은 P3 몫
- 일평균 · 최고 시간값 같은 다른 집계가 필요하면 원본에서 다시 정제해야 한다(시간 단위 정제 결과를 남기지 않으므로)

## 아직 없는 것

- 전재 묶음 칸(`syndication_group_id` 등) — 같은 보도자료를 여러 언론사가 쓴 기사 묶기
- 문서의 관측 일 묶음 — 문서는 `observed_period_start` · `observed_at` 이 비어 모두 `''` 한 묶음으로 정제된다. 기사가 많아지면 발행일(`published_at`)로 나눈다
- 수집기가 `c1_record` 를 채우는 것 (P1). 그 전까지 정제 저장은 모든 원본을 건너뛴다

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-22 | 초안: P2 칸 5개, 사유 코드 9개, 상태 규칙 (S15P31C108-79) |
| v0.1.1 | 2026-10-23 | 재수집(수집 실행 칸만 다름)은 충돌이 아니라 반복으로 보고 마지막으로 확인한 것을 내보냄. 스키마는 그대로 (S15P31C108-88) |
| v0.1.2 | 2026-10-23 | 문구: run_id 는 마지막 확인 실행이고 원본은 content_hash 로 찾음, 수집기 입구 검사는 `validate` 만. 스키마·정제 동작은 그대로 (S15P31C108-89) |
| v0.2 | 2026-10-26 | 저장: `normalized_record`(V0005) · `normalized_ready` 뷰. 입력은 P1 이 채우는 장부 `raw_record.c1_record`. 정제 레코드 스키마는 그대로 (S15P31C108-99) |
| v0.2.1 | 2026-10-27 | 빅카인즈를 금지 소스에서 빼고 이용허락 표에 `BIGKINDS-이용약관` → 최대 `metadata` 추가. 결과가 달라지므로 `rule_version` 을 `p2-0.2.0` 으로 올림 — 저장된 행은 다음 정제 때 모두 새 판으로 갱신된다. 스키마는 그대로 (S15P31C108-106) |
| v0.2.2 | 2026-10-27 | 저장: 장부를 관측 일 묶음으로 나눠 정제 · 묶음마다 커밋, 실행 결과에 `buckets`. 정제 결과는 한 번에 할 때와 같아 `rule_version` 그대로. 스키마는 그대로 (S15P31C108-111) |
| v0.3 | 2026-10-27 | 월별 집계 `air_monthly`(V0008): 에어코리아 시간값의 측정소 × 지표 × 월 평균 · 유효 시간 · 최솟값 · 최댓값 · 잠정 포함. 75% 미만이면 평균 null. `refine --db` 가 저장 뒤 새로 고침, 실행 결과에 `air_monthly`. 정제 레코드 스키마 · 결과는 그대로 (S15P31C108-114) |
| v0.4 | 2026-10-27 | 에어코리아 확정 시간값을 `normalized_record` 에 저장하지 않고 `air_monthly` 표(V0009, materialized view → 표)에만 저장. 정제가 시간마다 검증한 뒤 묶음마다 월 합계에 더해 마지막에 다시 씀. `held_hours` 추가, 실행 결과에 `air_unplaced`. V0009 가 기존 에어코리아 시간 정제 행을 지운다. 정제 규칙 · `rule_version` 은 그대로 (S15P31C108-115) |
| v0.5 | 2026-10-28 | 문서(C1 v0.2 기사 칸) 정제: 이용허락 표 `BIGKINDS-이용약관` → `full`(기사 본문 저장, 팀 결정), 저장 범위가 full 이 아닌 문서는 본문을 지우고 `BODY_STRIPPED_BY_SCOPE`(fixed). 문서에도 `obs_key` · `is_latest` — 같은 기사의 여러 판 중 본문 있는 판, 같으면 늦게 받은 판 하나만 `normalized_ready`. `source_text` 문서는 `place_code_raw = ""` 허용. 결과가 달라지므로 `rule_version` `p2-0.3.0` — 저장된 행은 다음 정제 때 새 판으로 갱신된다. DB 변경 없음 (S15P31C108-122) |
