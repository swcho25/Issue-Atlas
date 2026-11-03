# 관측 행 `observation` v0.2 — 통계 한 값 · 기사 한 건 = 한 행

기준: Notion 「시공간 표시 개발 명세」(2026-10-30) 2 · 3절. 표는 Flyway [V0025](../../backend/src/main/resources/db/migration/V0025__create_observation_view.sql)의 **view** 다. 새 표 없이 P2(`normalized_ready` · `air_monthly`) · P3(`news_event`)를 같은 칸으로 읽는다. 판정과 화면 응답(series)은 이 view 만 읽는다.

## 칸

명세의 `what` · `when` · `where` · `value` 를 SQL 에서 쓰기 쉽게 펼친 칸이다. JSON 모양은 응답을 만들 때 묶는다.

| 칸 | 명세 | 값 |
| --- | --- | --- |
| v0.3 | 2026-11-03 | 측정소 `station_id` 가 `kr-<부모 시군구 5자리>-s<에어코리아 코드>` 로 바뀜(V0032, view 는 그대로 — `place` 를 읽는다) |
| `obs_id` | `id` | `obs:` + sha256. 통계는 P2 `obs_key`, 대기는 `air_monthly\|<측정소 코드>\|<지표>\|<달 첫날 YYYY-MM-DD(한국)>`, 기사는 `news_event\|<news_id>` |
| `what_type` · `what_id` · `what_kind` · `tags` | `what` | `indicator`(통계) · `document`(글) / 지표 ID 또는 `news_id` / 글 종류(`news`) / 근거가 되는 카드(`{C1}` · `{A3}`, 없으면 빈 배열) |
| `when_start` · `when_end` · `when_unit` · `when_precision` | `when` | timestamptz, 끝은 미포함. 통계는 `when_unit`(`M` · `Y`), 글은 `when_precision`(`day` · `minute` · `month` · `published`) |
| `place_id` · `to_place_id` · `station_id` · `lon` · `lat` · `location_precision` | `where` | 통계는 시군구 `kr-<5자리>` 필수, 이동은 `to_place_id` = 도착 시도 `kr-<2자리>`, 측정소는 `station_id` + 좌표(`exact`) |
| `value` · `unit` · `status` | `value` · `status` | 값이 없으면 `value` null, `status` 에 이유(`not_published` …). 글은 `value` null · `available` |
| `source_table` · `spec_id` · `summary` | 선택(`source` · `attrs`) | 읽은 표, 수집 명세, 기사 요약 |

## 원자료 → 행

| 원자료 | 지표 ID (`what_id`) | 지역 | 빼는 것 |
| --- | --- | --- | --- |
| SP01 순이동 | `locator.C3`: 000 → `population_net_migration_total`, 901 → `_19_34`, 905 → `_19_39` · 태그 C1 | 시군구 | 대응표에 없는 연령 코드 |
| SP02 이동 | `population_movers` · 태그 C1 | 출발 시군구 → 도착 시도 `kr-<locator.C2>` | 전국 합계 `C2 = 00` |
| SP10 주민등록인구 | `locator.C2`: 000 → `population_registered_total`, 1005 → `_19`, 1201–1205 → `_20`–`_24`, 1301–1305 → `_25`–`_29`, 1501–1505 → `_30`–`_34`, 1601–1605 → `_35`–`_39` · 태그: 19–39세 각 나이 C1, 전체 C1 · A3 | 시군구 | 대응표에 없는 연령 코드 |
| `air_monthly` | `air_pm25` 등 그대로 · 태그 A3. 월평균이 없으면 `not_published` | 측정소의 시군구 + `station_id` | 측정소 코드가 `place_code_map` 에 없는 행 |
| `news_event` | `news_id`, `what_kind = news` | 기사 `place_id` · 좌표(못 정하면 null) | — |

- 지역은 `place_code_map` 으로 바꾼다. 옛 KOSIS 코드 46130 과 새 코드 12130 은 같은 `kr-12130`
- SP10 연령 코드는 KOSIS DT_1B04006 응답의 `C2_NM` 으로 확인했다(박준우, 2026-11-02). 앞 두 자리는 KOSIS 묶음 번호(10 · 12 · 13 · 15 · 16 …, 14 없음), 끝 자리 1–5 가 묶음 안 순서
- 수집기 · C1 은 지표 하나 + `locator` 그대로다. 연령을 지표 ID 에 넣는 것은 이 view 에서만 한다
- **통계 태그는 지표 사전(`contracts/cards/indicators.json`)의 `cards` 를 따른다**(V0031). 사전에 없는 지표(19–34세 · 전체 순이동, 대기 PM2.5 밖 5종)는 출처 기본 태그(SP01 → C1, 대기 → A3). 판정 · 그림은 태그가 아니라 지표 ID 로 고른다. 19–39세 인구 · 청년 인구 비율은 이 view 의 1세별 행을 판정 · 그림에서 더한다(view 는 계산 값을 만들지 않는다)
- 계산 값(연 합계 · 비율 · 19–39세 합 · 첫 관측)은 행으로 만들지 않는다

## 명세와 다른 곳 (아직)

- **측정소 행의 `place_id`**: 명세는 측정소가 있는 읍면동이지만, 측정소 → 읍면동 연결이 DB 에 없어 시군구로 둔다. 질문 고르기(「앞자리가 같은 것」)는 시군구로도 같다
- **기사 `tags`**: 명세는 수집 검색 분류(대기오염 → A3, 청년인구 → C1)지만, 지금 빅카인즈 수집은 검색어 하나(「여수 OR 광주」)라 분류가 없다. 기사 분류(P4)가 생기기 전까지 빈 배열
- **측정소 `station_id`**: 측정소 `place_id`(`kr-<부모 시군구 5자리>-s<코드>`, V0032). 앞자리가 그 측정소 행의 `place_id`(시군구)와 같다

## 실데이터 확인 (2026-11-02, 로컬 DB)

air 4,752 · SP01 648 · SP02 3,672 · SP10 396(연령 계 18 + 전에 빠졌던 378) = 9,468행, `obs_id` 중복 0, 지역 없는 통계 행 0. 명세 8절 수치와 같다(기사는 로컬에 없어 세지 않음).

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.2 | 2026-11-02 | 통계 태그를 지표 사전 `cards` 에 맞춤(V0031): `population_movers` C1, SP10 19–39세 각 나이 C1, `population_registered_total` C1 · A3. 칸 · 행은 그대로 (S15P31C108-196) |
| v0.1 | 2026-11-02 | 초안: `observation` view(V0025), SP01 · SP02 · SP10(연령 22코드) · 대기 · 기사 매핑 |
