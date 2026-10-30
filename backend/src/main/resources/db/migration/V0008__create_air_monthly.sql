-- 에어코리아 시간값의 측정소 × 지표 × 월 집계(contracts/p2 「월별 집계」).
-- 시간 자료(normalized_record)는 그대로 두고 그 위에 얹는다. P2 정제(refine --db)가 저장 뒤 새로 고친다.
-- 월은 한국 시각으로 자른다. 원천 「1월 31일 24시」(31일 23–24시)는 1월이다.
-- 월 계산은 시간대 없는 한국 시각(month_local)으로 해서 세션 시간대와 상관없이 같은 결과가 나온다.
CREATE MATERIALIZED VIEW air_monthly AS
WITH hourly AS (
    SELECT
        place_code_raw AS station_code,
        record -> 'locator' ->> '측정소명' AS station_name,
        indicator_id,
        unit,
        value,
        coalesce((record ->> 'is_provisional')::boolean, false) AS is_provisional,
        date_trunc('month', observed_period_start AT TIME ZONE 'Asia/Seoul') AS month_local
    FROM normalized_ready
    WHERE source_id = 'airkorea_final' AND observed_period_type = 'H'
),
monthly AS (
    SELECT
        station_code,
        -- 같은 달에 측정소 이름이 바뀌면 사전순으로 뒤의 것
        max(station_name) AS station_name,
        indicator_id,
        unit,
        month_local,
        -- 한국 시각은 일광 절약 시간이 없어 그 달 날짜 수 × 24
        (extract(epoch FROM month_local + interval '1 month' - month_local) / 3600)::integer
            AS month_hours,
        -- 결측(−999 · 빈칸)은 value 가 null 이라 평균 · 개수에서 빠진다
        count(value)::integer AS valid_hours,
        avg(value) AS valid_mean,
        min(value) AS value_min,
        max(value) AS value_max,
        bool_or(is_provisional) AS has_provisional
    FROM hourly
    GROUP BY station_code, indicator_id, unit, month_local
)
SELECT
    station_code,
    station_name,
    indicator_id,
    unit,
    month_local AT TIME ZONE 'Asia/Seoul' AS month_start,
    (month_local + interval '1 month') AT TIME ZONE 'Asia/Seoul' AS month_end,
    month_hours,
    valid_hours,
    -- 유효 시간이 그 달 시간의 75% 미만이면 월평균을 내지 않는다
    CASE WHEN valid_hours * 4 >= month_hours * 3 THEN valid_mean END AS value_mean,
    value_min,
    value_max,
    has_provisional
FROM monthly;

-- 새로 고치는 동안에도 읽을 수 있게(REFRESH ... CONCURRENTLY) 한 행을 가리키는 키
CREATE UNIQUE INDEX uq_air_monthly ON air_monthly (station_code, indicator_id, unit, month_start);
