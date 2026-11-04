-- 시군구 · 행정동 경계(폴리곤) 표(contracts/p3 v0.12 「경계」). place.geometry 는 대표점뿐이라
-- 화면이 고른 시군구 테두리를 그리고 행정동 안 점(측정소 · 기사)을 거를 경계가 없었다.
-- place 한 곳에 경계 하나. 값은 V0041 시드(engine pipeline.region.boundary 가 SGIS 행정구역 경계로 만든다).
-- 경계 연도가 바뀌면 새 마이그레이션으로 행을 바꾼다(PRD 7.6).
CREATE TABLE place_boundary (
    place_id text PRIMARY KEY REFERENCES place (place_id),
    boundary geography(MultiPolygon, 4326) NOT NULL,
    -- 출처(sgis_hadmarea = 통계청 SGIS 행정구역 경계)와 그 기준 연도 · 출처의 구역 코드
    source text NOT NULL,
    source_year smallint NOT NULL,
    source_code text NOT NULL,
    CONSTRAINT ck_place_boundary_shape CHECK (
        NOT ST_IsEmpty(boundary::geometry) AND ST_IsValid(boundary::geometry)
    )
);
CREATE INDEX idx_place_boundary ON place_boundary USING GIST (boundary);
