# P3 지역 · 시간 v0.11 — `news_event` · 측정소 · 시도 · 시군구 · 행정동 `place`

지역 · 시간(P3)이 P2 정제 결과([P2 계약](../p2/README.md))에 붙이는 것. 기사에는 요약 · 사건 시간대 · 위치를, 통계에는 지역 코드가 가리키는 위치를 붙인다.
**통계 값은 다시 저장하지 않는다.** 서비스는 요청 때 `normalized_ready` · `air_monthly` 를 지역 코드로 걸러 읽는다. 표는 Flyway [V0016](../../backend/src/main/resources/db/migration/V0016__create_news_event.sql) · [V0017](../../backend/src/main/resources/db/migration/V0017__seed_station_places.sql) · [V0020](../../backend/src/main/resources/db/migration/V0020__add_news_event_regions.sql).
계약 변경은 정우현(P3) · 받는 쪽 장성우(P7) 리뷰가 필요하다.

## 무엇을 어디에

| 자료 | 저장 위치 | 채우는 쪽 |
| --- | --- | --- |
| KOSIS 통계 | `normalized_ready` (그대로) | P2 |
| 에어코리아 월평균 | `air_monthly` (그대로) | P2 |
| 기사 요약 · 사건 시간대 · 위치 | **`news_event`** | P3 |
| 측정소 위치 · 코드 | `place`(`level = station`) · `place_code_map`(`airkorea_station`) | P3 (V0017 시드) |
| 시군구 중심 · 기사 지역 칸 | `place`(`level = sigungu`) 의 `geometry` · `attrs` | P3 (V0017 시드) |

통계 · 기사를 한 표로 합치지 않는다. 행 하나가 뜻하는 것(지역 × 지표 × 월 값 / 기사 한 건)과 다시 쓰는 방식이 다르다. 둘을 잇는 축은 `place_id` 와 기간이고, 논증 카드의 근거 한 건은 판정이 [`evidence`](../database/README.md)에 만든다.

## 기사 사건 — `news_event`

- **입력:** `normalized_ready` 의 기사(C1 `document.kind = news`). 같은 기사는 본문이 있는 최신 판 하나만 있다(P2 v0.5)
- **한 행 = 기사 하나(`news_id`).** 다시 돌리면 같은 `news_id` 행을 덮어쓴다. 기사 행은 마이그레이션에 넣지 않고 P3 파이프라인이 넣는다
- 원본 기사와는 `news_id` = `normalized_record.record -> 'locator' ->> 'news_id'` 로 잇는다(외래키 없음 — 정제 표는 판마다 한 행)
- **본문을 옮기지 않는다.** `summary` 는 화면에 보일 수 있는 한두 문장 요약이다([기사 계약](../article/README.md) 이용 규칙)

| 칸 | 뜻 |
| --- | --- |
| `news_id` | 빅카인즈 기사 ID (PK) |
| `summary` | 한두 문장 요약(LLM). 실패하면 null |
| `event_start` · `event_end` | 사건 시간대 `[start, end)`. 한 시각이면 `event_end` null |
| `time_precision` | `minute` 시각까지 · `day` 날짜까지 · `month` 달까지 · `published` 글에 날짜가 없어 발행 시각을 씀(`event_end` null) |
| `place_name` · `address` | 장소 이름(없으면 읍면동 · 시군구 이름) · 도로명주소(없으면 행정 주소) |
| `geometry` · `location_precision` | 좌표 · `address`(주소 좌표) / `admin_centroid`(읍면동 · 시군구 중심) / `none`(좌표 없음, `geometry` null) |
| `place_id` | 위치가 든 곳. 행정동 `kr-<8자리>`(좌표의 SGIS 행정동 코드 → `place_code_map` `sgis`, 광주 5구 · 여수시) → 그 밖 통합시 시군구 `kr-<5자리>` → 시도 대표점 `kr-<2자리>`. 외래키 없는 참고 값(행정동 `place` 가 없는 시군구도 있다). v0.9 전에 넣은 기사의 법정동 `kr-<10자리>` 는 `region-load --relocate` 가 행정동으로 바꾼다 |
| `sido` · `sigun` · `gu` | 기사 대표 지역. 정해지지 않은 단계는 null. 시도는 `전남광주통합특별시` · `전국` · 다른 시도, 시군은 `여수시` 등, 광주 5개 구는 시군 `광주` + 구 |
| `regions` | 기사 지역 전부(V0020, jsonb 배열). 원소 `{sido, sigun, gu}` 는 위 세 칸과 같은 값이고, **첫 원소가 대표 지역**으로 `sido` · `sigun` · `gu` 와 늘 같다. 여러 지역을 다룬 기사는 모두 넣는다. 전국이라 밝혔거나 특정 지역이 없으면 `[{"sido": "전국", "sigun": null, "gu": null}]`. 빈 배열 `[]`(기본값)은 보류(지역 미정)만 |
| `prompt_version` · `summary_version` · `model` | 만든 판(V0037): 지역 질문 프롬프트 판(`p9.1` …) · 요약 · 시간 질문 판(`s1.1` …) · 추출 모델 이름(`.env` `P3_LLM_MODEL`). `region-load` 가 추출 결과에서 채운다. **null = 판을 기록하기 전 적재**(2026-11-01 lab 적재 — p9.1 · s1 · Qwen2.5-32B-Instruct-AWQ). 다시 넣을 때 새 값이 없으면 있던 값을 지우지 않는다 |

CHECK: `event_end > event_start`, 좌표가 없으면 `location_precision = none`, 좌표는 경도 124–132 · 위도 33–39, `regions` 는 JSON 배열.

## 지역 맞추기

사용자가 고른 시군구 `place_id` 와 기사 지역 배열 `regions` 의 원소를 `place.attrs` 의 같은 세 값(`sido` · `sigun` · `gu`, V0017)으로 맞춘다. 원소 하나라도 맞으면 그 기사가 나온다.

```sql
SELECT e.*
FROM news_event e
JOIN place p ON p.place_id = :place_id
WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.regions) r
    WHERE r ->> 'sido' = p.attrs ->> 'sido'
      AND (r ->> 'sigun' IS NULL OR r ->> 'sigun' = p.attrs ->> 'sigun')
      AND (r ->> 'gu' IS NULL OR r ->> 'gu' = p.attrs ->> 'gu'))
```

여수 · 순천 기사는 여수와 순천 양쪽에, 광주 동구 · 북구 기사는 두 구에 모두 나온다. `전국` 기사는 시도가 달라 어느 시군구에도 나오지 않는다.

`kr-12210` 를 고르면 동구 기사, 「광주」 전체 기사(`gu` null), 시도 전체 기사(`sigun` null)가 함께 나온다. 넓은 단위 기사 · `전국` 기사를 근거에 넣을지는 카드 규칙이 정한다.

## 측정소 · 시군구 — `place` (V0017)

입력은 P3 지역표(2026-10-30, SGIS 시군구 중심 · 에어코리아 측정소 정보).

- **측정소 22곳**(여수 9 · 광주 13): `place_id = kr-<부모 시군구 5자리>-s<측정소 코드>`(V0032, 아래 「측정소 ID」. V0017 은 `plc_stn_<코드>` 로 넣었다), `level = station`, `parent_id` = 시군구, `location_precision = exact`, `geometry_role = station`, `attrs.address` = 도로명주소
- 측정소 코드는 `place_code_map(code_system = airkorea_station)`. `air_monthly.station_code` 와 같은 값이다. 코드 변경 이력을 아직 몰라 유효 기간은 비운다
- **시군구 6곳**(V0011): `geometry` = 행정 중심, `location_precision = admin_centroid`, `attrs` = `{sido, sigun, gu}`(여수시는 `gu` null)
- 측정소가 생기거나 옮기면 새 마이그레이션으로 고친다. 이미 적용된 V0017 은 고치지 않는다

## 측정소 ID — `kr-<시군구 5자리>-s<측정소 코드>` (V0032)

11/4 동결 문서의 「측정소 place_id `kr-` 형식」. 2026-11-03 제안 → 장성우(P1 · P7) 동의 → 동결 전에 바꿨다(정우현 · 장성우).

| | 옛(V0017) | 지금(V0032) |
| --- | --- | --- |
| 형식 | `plc_stn_<에어코리아 측정소 코드 6자리>` | `kr-<부모 시군구 KOSIS 5자리>-s<에어코리아 측정소 코드 6자리>` |
| 예 | `plc_stn_336121`(여수 서강동) · `plc_stn_324115`(광주 동구 서석동) | `kr-12130-s336121` · `kr-12210-s324115` |

- **만드는 법:** DB 값만 쓴다 — 부모 시군구(`place.parent_id`, V0024 뒤 `kr-<5>`)와 측정소 코드(`place_code_map` `airkorea_station`). 새 외부 자료가 필요 없다
- **앞자리로 고르기:** `starts_with(place_id, 'kr-12130')` 이 여수시와 여수 측정소 9곳을 함께 잡는다. 시도 · 시군구 · 행정동 ID 와 같은 「앞자리 = 상위 지역」 규칙이다
- **겹치지 않음:** `-s` 가 있어 숫자만인 지역 ID(`kr-<2 · 5 · 8 · 10자리>`)와 같은 값이 나올 수 없다. 받는 쪽은 ID 길이 · 자리 수로 뜻을 읽지 않는다(동결 문서 1절) — 측정소인지는 `level = station` 으로 본다
- **행정동을 넣지 않은 까닭:** 측정소가 있는 행정동(`kr-<8자리>-s…`)까지 담으면 명세(측정소 행 = 읍면동)에 더 가깝지만, 22곳의 행정동을 SGIS 역지오코딩으로 새로 정해야 하고 경계 자료(아래 「아직 없는 것」)도 없다. 시군구까지만 담는다(정우현 2026-11-03)
- **옮기면:** 측정소가 다른 시군구로 옮기면 ID 가 바뀐다. 지금 측정소 이전 이력이 없어(동결 문서 「아직 안 정한 것」) A3 는 같은 `station_id` 끼리만 비교한다 — 이전 이력이 생기면 같은 측정소의 옛 · 새 ID 를 그 이력으로 잇는다. 2023–2025 실제 이전은 여천동(336127) 1곳뿐이고 같은 여수시 안이라 ID 가 안 바뀐다 — 다른 시군구로 옮긴 측정소 0곳(장성우 2026-11-03, 개발 DB 확정자료 주소 칸)

바꾼 방법(V0032, V0024 와 같다): FK 에 ON UPDATE CASCADE 가 없어 새 ID 로 행 복사 → 참조 옮김 → 옛 행 지움. V0017 은 고치지 않고 `place_code_map.place_id` 만 옮겼다(에어코리아 코드 값은 그대로). 옛 형식이 하나라도 남으면 마이그레이션이 멈춘다. backend 코드는 `observation.station_id` → `place` 조인만 써서 바뀌지 않았다:

| 바뀐 곳 | 무엇 |
| --- | --- |
| DB | `place` 측정소 22행, `place_code_map`(`airkorea_station` · `airkorea_station_name`)의 `place_id`, 저장된 실행 결과(`argument_run` 의 `series[].station_id`). `observation` 의 `station_id` 는 view 라 따라 바뀐다. `air_monthly.station_code` 는 에어코리아 코드 그대로 |
| 계약 · 예시 | `contracts/c2/examples/observations-a3-yeosu.json` · `argument-a3-not-comparable.json`, `contracts/ai/examples/judgment-not-comparable.json`, observation · freeze 문서 |
| backend 테스트 | `StationPlaceSeedTest` · `ObservationApiTest` · `ObservationViewTest` · `QuestionApiTest` · `PlaceParentsTest` |
| 받는 쪽 | 장성우(P1 에어코리아 · P7 응답) 동의. P5(A3 판정) · frontend(측정소 지도 `series[].station_id`)에 알림 — frontend 에는 측정소 ID 를 쓰는 코드가 아직 없다(2026-11-03 모든 원격 브랜치) |

| 측정소 | 옛(V0017) | 지금(V0032) |
| --- | --- | --- |
| 여수 9곳 | `plc_stn_336121` · `336124` · `336125` · `336127` · `336128` · `336221` · `336222` · `336223` · `336903` | `kr-12130-s336121` … |
| 광주 동구 1곳 | `plc_stn_324115` | `kr-12210-s324115` |
| 광주 서구 3곳 | `plc_stn_324121` · `324123` · `324125` | `kr-12240-s324121` … |
| 광주 남구 2곳 | `plc_stn_324124` · `324155` | `kr-12270-s324124` … |
| 광주 북구 4곳 | `plc_stn_324133` · `324134` · `324135` · `324136` | `kr-12300-s324133` … |
| 광주 광산구 3곳 | `plc_stn_324142` · `324143` · `324148` | `kr-12330-s324142` … |

## 시도 · 코드 연결 — `place` · `place_code_map` (V0018)

2026-11-01 개발 DB 에서 출처마다 지역 코드를 세어, `place_code_map` 에 없어 지역으로 잇지 못하던 코드를 이었다. 통계 값은 그대로 두고 코드만 잇는다.

| 출처 | 코드 | 잇는 곳 |
| --- | --- | --- |
| KOSIS 이동(SP02) 도착 시도 `locator.C2` | `kosis` 2자리 17곳(11 · 26 … · 광주 29 · 전남 46 따로) | 시도 `place` `kr-<코드>` (이동 지도의 도착점) |
| 세출 「광주 본청」 · 보도자료 광주광역시 | `kosis` `29`(광주 전체) | `kr-29` 광주광역시(5개 구) |
| 온통청년 청년정책 `zipCd` | `bjd` `12130` · `12210` …(통합 뒤 새 시군구 코드) | 시군구 6곳(KOSIS 새 코드와 같은 place) |
| 에어코리아 측정소 메타 | `airkorea_station_name`(괄호까지 그대로, 「우산동(광주)」) | 측정소 22곳 |

- **시도 18곳**: KOSIS 2자리 17곳 + 통합시 `kr-12`(KOSIS `12`, 2026-07-01부터). `level = sido`, `location_precision = admin_centroid`, 좌표는 P3 시도 대표점(SGIS 시도 중심, 인천은 시청, 광주 29 · 전남 46 은 5개 구 · 22개 시군 중심의 평균). `kr-29` · `kr-46` 의 부모는 `kr-12`
- `attrs` 는 `news_event` 지역 칸과 같은 값: `kr-29` = {통합시, 광주}, `kr-12` = {통합시}, 다른 시도 = {`충남` 등}. 옛 전남 `kr-46` 은 기사 지역 값이 없어 비운다. 그래서 `news_event.place_id`(`kr-29` · `kr-12` · `kr-44` …)가 가리키는 place 가 생겼다
- `place_id` 는 `kr-<코드>`. 시군구 6곳도 V0024 부터 `kr-<KOSIS 새 시군구 5자리>`(동구 `kr-12210` · 여수시 `kr-12130`)다. 측정소는 V0032 부터 `kr-<시군구 5자리>-s<코드>`
- 지역 목록 `GET /v1/places` 는 시도를 내보내지 않는다(고르는 지역이 아니다)

## 상위 지역 자료 — `place.parent_id` (V0021)

광주시청(본청) 세출 · 광주시 보도자료처럼 **시군구보다 넓은 지역 코드**가 붙은 자료는 고른 시군구에서 상위 지역으로 올라가 찾는다.

```
통합시 kr-12 (KOSIS 12)
├─ 광주광역시(5개 구) kr-29 (KOSIS 29 ← 세출 「광주 본청」 · 보도자료 광주광역시)
│   └─ 광주 동구 · 서구 · 남구 · 북구 · 광산구 (V0021)
└─ 옛 전라남도(22개 시군) kr-46 (KOSIS 46)
    └─ 여수시 (V0021)
```

```sql
-- 고른 지역(:place_id)과 그 상위 지역의 코드. depth 0 = 고른 지역, 1 이상 = 상위 지역
WITH RECURSIVE up AS (
    SELECT place_id, parent_id, 0 AS depth FROM place WHERE place_id = :place_id
    UNION ALL
    SELECT p.place_id, p.parent_id, up.depth + 1 FROM place p JOIN up ON p.place_id = up.parent_id
)
SELECT up.place_id, up.depth, c.code_system, c.place_code, c.valid_from, c.valid_to
FROM up JOIN place_code_map c ON c.place_id = up.place_id
```

- 자료 행의 `(place_code_system, place_code_raw)` 가 이 목록에 있으면 그 지역 자료다. 광주 동구를 고르면 동구 코드(29110 · 12210)와 함께 광주 전체 `29` · 통합시 `12` 가 나와 본청 세출 · 광주시 보도자료가 잡힌다
- **depth 1 이상 자료는 「상위 지역 자료」로 따로 보여 준다.** 구의 근거로 셀지는 넓은 지역 기사와 같은 결정이다(아래 「아직 없는 것」)
- 행정동(V0019)의 상위는 시군구, 측정소(V0017)의 상위도 시군구다. 지역 목록의 시군구 `parent_id` 는 `kr-29` · `kr-46` 으로 나간다(시도는 목록에 없다)

## 행정동 — `place` (V0019)

PRD FR-A1(지역 계층 시 → 구·군 → 읍·면·동)의 읍·면·동. **법정동이 아니라 행정동**으로 만든다. 사용자가 아는 동 이름(주민센터)과 주민등록 읍면동 통계가 행정동이다. 입력은 P3 행정동 표(p3-region-lab `data/emd_points.tsv`, 2026-11-01 SGIS).

| 칸 | 값 |
| --- | --- |
| 행 | 우리 시군구 6곳의 행정동 **123곳**: 광주 동구 13 · 서구 18 · 남구 17 · 북구 27 · 광산구 21, 여수시 27 |
| `place_id` | `kr-<KOSIS 새 시군구 5자리><SGIS 읍면동 3자리>` (동구 계림1동 `kr-12210560`). 시군구 KOSIS 코드와 접두가 같고. 기사 위치 `place_id` 도 v0.9 부터 이 값이다 |
| `level` · `parent_id` | `emd` · 시군구 place |
| `geometry` · `location_precision` | SGIS 행정동 대표점 · `admin_centroid` |
| `attrs` | 부모 시군구의 `{sido, sigun, gu}` + `emd`(행정동 이름) |
| `place_code_map` | `sgis` 8자리 두 줄: 통합 전(`24010560`, ~2026-06-30) · 통합 뒤(`12060560`, 2026-07-01~). SGIS 단계별 주소는 옛 코드, 지오코딩은 새 코드를 주고 읍면동 3자리는 같다(123곳 모두 확인) |

- **행정동은 시군구 안의 내부 선택이다(2026-11-01 결정).** 사용자는 시군구를 고르고, 질문(`place_id`) · 카드 판정 · 통계는 시군구로 한다(통계가 모두 시군구 단위). 화면은 고른 시군구의 경계를 그리고, 그 안에서 행정동을 고르면 지도 · 기사를 그 행정동으로 좁혀 보여 준다. 판정 결과는 바뀌지 않는다
- 지역 목록: `GET /v1/places?parent_id=<시군구>` 가 그 시군구의 행정동을 돌려준다([C2](../c2/README.md)). 기본 목록(시군구 6곳)은 그대로다
- 이름이 같은 행정동(우산동: 북구 · 광산구)은 `place_id` · 코드로 갈린다
- 행정동이 나뉘거나 합쳐지면 새 마이그레이션으로 새 `place_id` 를 만든다(PRD 7.6). 이미 적용된 V0019 는 고치지 않는다

## 아직 없는 것

- 측정소 유형(도시대기 · 도로변 · 항만 …). C2 `station_type` 은 null 로 나간다
- 기사 ↔ 행정동: v0.9 부터 새로 적재하는 기사는 좌표가 든 행정동(SGIS 지오코딩 결과의 행정동 코드)으로 잇는다. 이미 넣은 기사(2026-11-01 lab 적재)의 법정동 `kr-<10자리>` 553건은 `region-load --relocate` 로 바꾼다 — 저장된 주소를 SGIS 로 다시 찍어 그 점이 든 행정동(좌표 · 주소는 그대로). SGIS 키를 넣고 돌릴 때까지는 남아 있다
- 주민등록 읍면동 인구(SP19, 카드 C2) 수집과 그 코드(행정기관코드) 연결
- 시군구 · 행정동 경계(폴리곤). `place.geometry` 는 대표점뿐이라 화면의 테두리 · 행정동 안 점 거르기에 쓸 경계가 아직 없다
- 만든 판 중 지역 규칙(regions · checks) 판 — 프롬프트 · 모델 판은 V0037 에 있다. 규칙 판은 engine 커밋으로만 알 수 있다
- 보도자료(`press_release`)의 사건 시간
- 넓은 지역 기사(광주 구 모름 · 통합시 전체) · 상위 지역 자료(광주 본청 세출 · 광주시 보도자료)를 구의 근거로 셀지 — 지금 「지역 맞추기」 쿼리는 모든 구에 함께 넣는다. 대표 피드백(2026-11-01 #6 「특정 구 근거로 집계 금지」)에 맞춰 정해야 한다
- 기사 ↔ 카드 분류(P4)

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-30 | 초안: `news_event`(V0016), 측정소 22곳 · 시군구 6곳 위치(V0017), 지역 맞추기 규칙 (S15P31C108-148) |
| v0.2 | 2026-11-01 | 시도 18곳 `place`(`kr-<코드>`, 대표점)와 코드 연결(V0018): KOSIS 시도 2자리 · 광주 전체 29 · 온통청년 `bjd` · 측정소 이름. `GET /v1/places` 는 시도를 빼고 내보낸다. 개발 DB `news_event` 3,477건 적재(p9.1 · s1) |
| v0.3 | 2026-11-01 | 행정동 123곳 `place`(`level = emd`, `kr-<KOSIS 시군구><읍면동 3자리>`, SGIS 대표점)와 SGIS 행정동 코드 통합 전 · 뒤 두 줄(V0019). `GET /v1/places?parent_id=` 로 시군구의 행정동을 내보낸다 (S15P31C108-167) |
| v0.4 | 2026-11-01 | 기사 지역 배열 `news_event.regions`(V0020, jsonb · GIN): 여러 지역을 다룬 기사는 지역을 모두 두고 첫 원소가 대표 지역(`sido` · `sigun` · `gu` 칸과 같음), 전국 · 지역 없음은 `전국` 한 원소, `[]` 는 보류만. 「지역 맞추기」를 원소 하나라도 맞으면 고르도록 바꿈. 기존 행은 지역 칸 하나로 채움 (S15P31C108-168) |
| v0.5 | 2026-11-01 | 시군구 상위 지역(V0021): 광주 5개 구 → `kr-29`, 여수시 → `kr-46`. 고른 지역과 상위 지역 코드로 자료를 찾는 법(재귀 SQL) — 광주 본청 세출 · 광주시 보도자료가 구에서 「상위 지역 자료」로 잡힌다 (S15P31C108-169) |
| v0.6 | 2026-11-02 | 시군구 6곳 `place_id` 를 `plc_*` → `kr-<KOSIS 새 시군구 5자리>` 로 바꿈(V0024): 광주 동구 `kr-12210` · 서구 `kr-12240` · 남구 `kr-12270` · 북구 `kr-12300` · 광산구 `kr-12330` · 여수시 `kr-12130`. 참조 표(`place.parent_id` · `place_code_map` · `card_evidence_status` · `existing_response` · `question` · 저장된 실행 결과)를 함께 옮긴다. 측정소 `plc_stn_*` 은 형식을 정한 뒤 바꾼다 |
| v0.7 | 2026-11-03 | **제안(리뷰 전):** 측정소 `place_id` 를 `kr-<부모 시군구 5자리>-s<에어코리아 측정소 코드>` 로(「측정소 ID 제안」). 아직 바꾸지 않는다 — 받는 쪽이 동의하면 마이그레이션 MR 로 |
| v0.8 | 2026-11-03 | 측정소 22곳 `place_id` 를 `kr-<부모 시군구 5자리>-s<에어코리아 측정소 코드>` 로 바꿈(V0032, 장성우 동의 · 11/4 동결 전): `plc_stn_336121` → `kr-12130-s336121`. `place_code_map` · 저장된 실행 결과의 측정소 ID 를 함께 옮긴다 (S15P31C108-198) |
| v0.9 | 2026-11-03 | 기사 위치를 `region-load` 가 정한다(engine `pipeline/region/locate`, SGIS): 장소 도로명주소 → 건물 좌표 → 행정 구역 중심 → 시도 대표점. 기사 `place_id` 는 법정동 `kr-<10>` 대신 행정동 `kr-<8>` · 시군구 `kr-<5>` · 시도 `kr-<2>`. 새 위치가 `none` 이면 이미 있는 위치를 지우지 않는다 (S15P31C108-206) |
| v0.10 | 2026-11-03 | `region-load --relocate`: 이미 넣은 기사의 법정동 `place_id` 를 저장된 주소로 행정동 `kr-<8>`(없으면 시군구 `kr-<5>`)로 바꾼다. 좌표 · 주소는 그대로. 개발 DB 553건이 대상 (S15P31C108-210) |
| v0.11 | 2026-11-03 | `news_event` 에 만든 판 칸 `prompt_version` · `summary_version` · `model`(V0037, null 허용). `region-load` 가 추출 결과의 판 · 모델을 저장 — LLM 결과 출처 표시. 기존 행은 null (S15P31C108-218) |
