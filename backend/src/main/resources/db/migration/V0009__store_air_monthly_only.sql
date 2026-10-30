-- 에어코리아 확정 시간값은 normalized_record 에 두지 않고 월별 표에만 둔다(contracts/p2 「월별 집계」).
-- 시간 단위 정제 결과는 행당 약 2.4KB 로 3년 치(약 347만 행)면 약 8GB 다. 카드 · P3 · P4 는 월 값을 쓴다.
-- P2 정제(refine --db)가 시간마다 검증하고 최신본을 고른 뒤 측정소 × 지표 × 월로 모아 이 표를 다시 쓴다.
-- 원본(raw_record)은 시간 단위 그대로 남으므로 월평균의 근거는 원본으로 따라간다.
DROP MATERIALIZED VIEW air_monthly;

CREATE TABLE air_monthly (
    station_code text NOT NULL,
    station_name text,
    indicator_id text NOT NULL,
    unit text,
    -- 한국 시각 [1일 0시, 다음 달 1일 0시)
    month_start timestamptz NOT NULL,
    month_end timestamptz NOT NULL,
    -- 그 달 시간 수(날짜 수 × 24)
    month_hours integer NOT NULL CHECK (month_hours > 0),
    -- 값이 있는 시간 수. 결측(−999 · 빈칸)은 세지 않는다
    valid_hours integer NOT NULL CHECK (valid_hours >= 0),
    -- 쓸 수 있는 판이 없이 보류(held)만 있는 시간 수
    held_hours integer NOT NULL CHECK (held_hours >= 0),
    -- 유효 시간값의 산술평균. 유효 시간이 그 달 시간의 75% 미만이면 null
    value_mean numeric,
    value_min numeric,
    value_max numeric,
    has_provisional boolean NOT NULL,
    PRIMARY KEY (station_code, indicator_id, month_start),
    CONSTRAINT ck_air_monthly_month CHECK (month_end > month_start),
    CONSTRAINT ck_air_monthly_mean CHECK (value_mean IS NULL OR valid_hours * 4 >= month_hours * 3)
);
CREATE INDEX idx_air_monthly_month ON air_monthly (month_start);

-- 시간 단위 정제 결과는 원본에서 다시 만들 수 있다. 다음 정제부터는 월별 표만 채운다
DELETE FROM normalized_record WHERE source_id = 'airkorea_final';
