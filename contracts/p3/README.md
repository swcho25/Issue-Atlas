# P3 지역 · 시간 v0.1 — `news_event` · 측정소 · 시군구 `place`

지역 · 시간(P3)이 P2 정제 결과([P2 계약](../p2/README.md))에 붙이는 것. 기사에는 요약 · 사건 시간대 · 위치를, 통계에는 지역 코드가 가리키는 위치를 붙인다.
**통계 값은 다시 저장하지 않는다.** 서비스는 요청 때 `normalized_ready` · `air_monthly` 를 지역 코드로 걸러 읽는다. 표는 Flyway [V0016](../../backend/src/main/resources/db/migration/V0016__create_news_event.sql) · [V0017](../../backend/src/main/resources/db/migration/V0017__seed_station_places.sql).
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
| `place_id` | 위치의 읍면동 · 시군구. 읍면동 `place` 행이 아직 없어 외래키 없는 참고 값 |
| `sido` · `sigun` · `gu` | 기사 지역. 정해지지 않은 단계는 null. 시도는 `전남광주통합특별시` · `전국` · 다른 시도, 시군은 `여수시` 등, 광주 5개 구는 시군 `광주` + 구 |

CHECK: `event_end > event_start`, 좌표가 없으면 `location_precision = none`, 좌표는 경도 124–132 · 위도 33–39.

## 지역 맞추기

사용자가 고른 시군구 `place_id` 와 기사 지역 칸은 `place.attrs` 의 같은 세 값(`sido` · `sigun` · `gu`, V0017)으로 맞춘다.

```sql
SELECT e.*
FROM news_event e
JOIN place p ON p.place_id = :place_id
WHERE e.sido = p.attrs ->> 'sido'
  AND (e.sigun IS NULL OR e.sigun = p.attrs ->> 'sigun')
  AND (e.gu IS NULL OR e.gu = p.attrs ->> 'gu')
```

`plc_gwangju_donggu` 를 고르면 동구 기사, 「광주」 전체 기사(`gu` null), 시도 전체 기사(`sigun` null)가 함께 나온다. 넓은 단위 기사 · `전국` 기사를 근거에 넣을지는 카드 규칙이 정한다.

## 측정소 · 시군구 — `place` (V0017)

입력은 P3 지역표(2026-10-30, SGIS 시군구 중심 · 에어코리아 측정소 정보).

- **측정소 22곳**(여수 9 · 광주 13): `place_id = plc_stn_<측정소 코드>`([C2 예시](../c2/examples/observations-a3-yeosu.json)와 같음), `level = station`, `parent_id` = 시군구, `location_precision = exact`, `geometry_role = station`, `attrs.address` = 도로명주소
- 측정소 코드는 `place_code_map(code_system = airkorea_station)`. `air_monthly.station_code` 와 같은 값이다. 코드 변경 이력을 아직 몰라 유효 기간은 비운다
- **시군구 6곳**(V0011): `geometry` = 행정 중심, `location_precision = admin_centroid`, `attrs` = `{sido, sigun, gu}`(여수시는 `gu` null)
- 측정소가 생기거나 옮기면 새 마이그레이션으로 고친다. 이미 적용된 V0017 은 고치지 않는다

## 아직 없는 것

- 측정소 유형(도시대기 · 도로변 · 항만 …). C2 `station_type` 은 null 로 나간다
- 읍면동 `place` 행과 그 `place_id` 형식(P3 지역표는 `kr-<코드>`)
- 만든 판 칸 — 요약 · 시간대 · 지역 규칙의 판이 행에 없다
- 보도자료(`press_release`)의 지역 · 시간
- 기사 ↔ 카드 분류(P4)

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-30 | 초안: `news_event`(V0016), 측정소 22곳 · 시군구 6곳 위치(V0017), 지역 맞추기 규칙 (S15P31C108-148) |
