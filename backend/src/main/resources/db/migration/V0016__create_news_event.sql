-- P3 기사 사건 표(contracts/p3). 빅카인즈 기사 하나에 요약 · 사건 시간대 · 위치 하나. P3 지역 · 시간 파이프라인이 채운다.
-- 원본 기사와는 news_id 로 잇는다(normalized_record.record -> 'locator' ->> 'news_id', normalized_ready 의 최신 판).
-- 외래키는 걸지 않는다: normalized_record 에는 news_id 하나에 한 행인 칸이 없다(같은 기사의 판마다 한 행).
CREATE TABLE news_event (
    -- 빅카인즈 기사 ID
    news_id text PRIMARY KEY,
    -- 한두 문장 요약(LLM). 본문을 옮기지 않는다. 요약에 실패한 기사는 null
    summary text,
    -- 사건 시간대. 끝은 미포함, 한 시각이면 null. 날짜가 글에 없으면 발행 시각, 끝은 null(published)
    event_start timestamptz NOT NULL,
    event_end timestamptz,
    time_precision text NOT NULL CHECK (time_precision IN ('minute', 'day', 'month', 'published')),
    -- 위치: 장소 이름(없으면 읍면동 · 시군구 이름) → 도로명주소(없으면 행정 주소) → 좌표
    place_name text,
    address text,
    geometry geography(Point, 4326),
    location_precision text NOT NULL DEFAULT 'none'
        CHECK (location_precision IN ('address', 'admin_centroid', 'none')),
    -- 위치의 place_id(읍면동 · 시군구). 읍면동 place 행이 아직 없어 외래키는 걸지 않는다
    place_id text,
    -- 기사 지역을 시도 · 시군 · 구로 나눈다. 정해지지 않은 단계는 null. 서비스는 place.attrs 의 같은 세 값(V0017)으로 맞춘다
    -- 시도: 전남광주통합특별시 · 전국 · 다른 시도(충남 · 서울 …)
    sido text NOT NULL,
    -- 시 · 군(여수시 · 영광군 …). 광주 5개 구는 「광주」로 묶는다(옛 광주광역시 구를 지금 기준으로)
    sigun text,
    -- 광주의 구(동구 · 서구 · 남구 · 북구 · 광산구)
    gu text,
    CONSTRAINT ck_news_event_period CHECK (event_end IS NULL OR event_end > event_start),
    CONSTRAINT ck_news_event_precision CHECK (geometry IS NOT NULL OR location_precision = 'none'),
    CONSTRAINT ck_news_event_coordinates CHECK (
        geometry IS NULL OR (
            ST_X(geometry::geometry) BETWEEN 124 AND 132 AND
            ST_Y(geometry::geometry) BETWEEN 33 AND 39
        )
    )
);
CREATE INDEX idx_news_event_start ON news_event (event_start);
CREATE INDEX idx_news_event_region ON news_event (sido, sigun, gu);
CREATE INDEX idx_news_event_geometry ON news_event USING GIST (geometry);
