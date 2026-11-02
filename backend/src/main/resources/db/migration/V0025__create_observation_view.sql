-- 관측 한 건(통계 한 값 · 기사 한 건) = 한 행인 view(contracts/observation, 「시공간 표시 개발 명세」 2·3절).
-- 새 표 없이 P2(normalized_ready · air_monthly) · P3(news_event)를 같은 칸으로 읽는다. 판정 · 화면 응답(series)은 이 view 만 읽는다.
-- 통계 행은 지역(place_id)이 있어야 해서 place_code_map 에 없는 코드는 빠진다. 계산 값(연 합계 · 비율 · 첫 관측)은 만들지 않는다.
-- 연령 · 성별은 지표 ID 에 넣는다(C1 · 수집기는 지표 하나 + locator 그대로, 여기서만 나눈다).
CREATE VIEW observation AS
WITH indicator_code (spec_id, code, what_id, tag) AS (
    VALUES
        -- SP01 순이동: locator.C3 연령
        ('SP01', '000', 'population_net_migration_total', 'C1'),
        ('SP01', '901', 'population_net_migration_19_34', 'C1'),
        ('SP01', '905', 'population_net_migration_19_39', 'C1'),
        -- SP10 주민등록인구: locator.C2 연령. 1세별 코드는 묶음 번호(12 · 13 · 15 · 16) + 묶음 안 순서 1–5
        -- (KOSIS DT_1B04006 C2_NM 으로 확인, 박준우 2026-11-02): 1201 = 20세 … 1605 = 39세
        ('SP10', '000', 'population_registered_total', NULL),
        ('SP10', '1005', 'population_registered_19', NULL)
    UNION ALL
    SELECT 'SP10', g.prefix || '0' || i, 'population_registered_' || (g.first_age + i - 1), NULL
    FROM (VALUES ('12', 20), ('13', 25), ('15', 30), ('16', 35)) AS g (prefix, first_age),
         generate_series(1, 5) AS i
),
stat AS (
    SELECT n.*,
           CASE n.spec_id
               WHEN 'SP01' THEN n.record -> 'locator' ->> 'C3'
               WHEN 'SP10' THEN n.record -> 'locator' ->> 'C2'
           END AS age_code
    FROM normalized_ready n
    WHERE n.spec_id IN ('SP01', 'SP02', 'SP10') AND n.obs_key IS NOT NULL
)
SELECT
    s.obs_key AS obs_id,
    'indicator' AS what_type,
    coalesce(k.what_id, s.indicator_id) AS what_id,
    NULL::text AS what_kind,
    CASE WHEN k.tag IS NULL THEN '{}'::text[] ELSE ARRAY[k.tag] END AS tags,
    s.observed_period_start AS when_start,
    s.observed_period_end AS when_end,
    s.observed_period_type AS when_unit,
    NULL::text AS when_precision,
    m.place_id,
    -- SP02 이동: 도착 시도(locator.C2) = 시도 place kr-<2자리>(V0018)
    CASE WHEN s.spec_id = 'SP02' THEN 'kr-' || (s.record -> 'locator' ->> 'C2') END AS to_place_id,
    NULL::text AS station_id,
    NULL::double precision AS lon,
    NULL::double precision AS lat,
    'none' AS location_precision,
    s.value,
    s.unit,
    coalesce(s.missing_reason, 'available') AS status,
    'normalized_record' AS source_table,
    s.spec_id,
    NULL::text AS summary
FROM stat s
JOIN place_code_map m ON m.code_system = s.place_code_system AND m.place_code = s.place_code_raw
LEFT JOIN indicator_code k ON k.spec_id = s.spec_id AND k.code = s.age_code
-- SP01 · SP10 은 대응표에 있는 연령 코드만, SP02 는 전국 합계(C2 = 00)를 뺀다
WHERE CASE s.spec_id
          WHEN 'SP02' THEN s.record -> 'locator' ->> 'C2' <> '00'
          ELSE k.what_id IS NOT NULL
      END

UNION ALL

-- 에어코리아 측정소 × 지표 × 월. 지역은 측정소의 시군구(측정소가 있는 읍면동은 아직 잇지 않았다)
SELECT
    'obs:' || encode(sha256(convert_to(
        'air_monthly|' || a.station_code || '|' || a.indicator_id || '|'
            || to_char(a.month_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'), 'UTF8')), 'hex'),
    'indicator',
    a.indicator_id,
    NULL,
    ARRAY['A3'],
    a.month_start,
    a.month_end,
    'M',
    NULL,
    st.parent_id,
    NULL,
    st.place_id,
    ST_X(st.geometry::geometry),
    ST_Y(st.geometry::geometry),
    st.location_precision,
    a.value_mean,
    a.unit,
    CASE WHEN a.value_mean IS NULL THEN 'not_published' ELSE 'available' END,
    'air_monthly',
    NULL,
    NULL
FROM air_monthly a
JOIN place_code_map c ON c.code_system = 'airkorea_station' AND c.place_code = a.station_code
JOIN place st ON st.place_id = c.place_id

UNION ALL

-- 기사 한 건. 근거가 되는 카드(tags)는 기사 분류(P4)가 생기기 전까지 비운다
SELECT
    'obs:' || encode(sha256(convert_to('news_event|' || e.news_id, 'UTF8')), 'hex'),
    'document',
    e.news_id,
    'news',
    '{}'::text[],
    e.event_start,
    e.event_end,
    NULL,
    e.time_precision,
    e.place_id,
    NULL,
    NULL,
    ST_X(e.geometry::geometry),
    ST_Y(e.geometry::geometry),
    e.location_precision,
    NULL,
    NULL,
    'available',
    'news_event',
    NULL,
    e.summary
FROM news_event e;
