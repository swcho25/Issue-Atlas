-- 수집·지역 기준 테이블. 기존 V0001(PostGIS)은 수정하지 않는다.
CREATE TABLE source (
    source_id text PRIMARY KEY,
    name text NOT NULL,
    org text NOT NULL,
    license_type text NOT NULL,
    storage_scope text NOT NULL CHECK (storage_scope IN ('full', 'metadata', 'link_only')),
    reliability_grade text CHECK (reliability_grade IN ('A', 'B', 'C')),
    robots_status text CHECK (robots_status IN ('allowed', 'blocked', 'n/a'))
);

CREATE TABLE source_spec (
    spec_id text PRIMARY KEY,
    source_id text NOT NULL REFERENCES source (source_id),
    method text NOT NULL CHECK (method IN ('api', 'file', 'board', 'rss')),
    schedule text,
    params jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(params) = 'object'),
    evidence_class text NOT NULL CHECK (evidence_class IN (
        'statistics', 'documents', 'existing_responses', 'denominators'
    ))
);
CREATE INDEX idx_source_spec_source ON source_spec (source_id);

CREATE TABLE job_run (
    job_run_id text PRIMARY KEY,
    spec_id text NOT NULL REFERENCES source_spec (spec_id),
    collector_version text NOT NULL,
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    -- null은 종료 전 실행. 종료 상태는 ERD의 세 가지 값을 보존한다.
    status text CHECK (status IN ('ok', 'failed', 'aborted')),
    stats jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(stats) = 'object'),
    CONSTRAINT uq_job_run_spec UNIQUE (job_run_id, spec_id),
    CONSTRAINT ck_job_run_time CHECK (finished_at IS NULL OR finished_at >= started_at),
    CONSTRAINT ck_job_run_completion CHECK (
        (status IS NULL AND finished_at IS NULL) OR
        (status IS NOT NULL AND finished_at IS NOT NULL)
    )
);
CREATE INDEX idx_job_run_spec_started ON job_run (spec_id, started_at);

CREATE TABLE raw_record (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_run_id text NOT NULL,
    spec_id text NOT NULL,
    raw_url text,
    file_name text,
    content_hash text UNIQUE,
    -- metadata/link_only 수집은 원문 본문을 저장하지 않을 수 있다.
    payload jsonb,
    collected_at timestamptz NOT NULL,
    CONSTRAINT fk_raw_record_run_spec FOREIGN KEY (job_run_id, spec_id)
        REFERENCES job_run (job_run_id, spec_id),
    CONSTRAINT ck_raw_record_origin CHECK (raw_url IS NOT NULL OR file_name IS NOT NULL)
);
CREATE INDEX idx_raw_record_run_spec ON raw_record (job_run_id, spec_id);
CREATE INDEX idx_raw_record_spec_collected ON raw_record (spec_id, collected_at);

CREATE TABLE place (
    place_id text PRIMARY KEY,
    name text NOT NULL,
    level text NOT NULL CHECK (level IN ('sido', 'sigungu', 'emd', 'station')),
    parent_id text REFERENCES place (place_id),
    geometry geography(Point, 4326),
    location_precision text NOT NULL DEFAULT 'none'
        CHECK (location_precision IN ('exact', 'address', 'admin_centroid', 'none')),
    geometry_role text CHECK (geometry_role IN ('event', 'affected_area', 'office', 'station')),
    attrs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attrs) = 'object'),
    CONSTRAINT ck_place_not_self CHECK (parent_id IS NULL OR parent_id <> place_id),
    CONSTRAINT ck_place_precision CHECK (geometry IS NOT NULL OR location_precision = 'none'),
    CONSTRAINT ck_place_coordinates CHECK (
        geometry IS NULL OR (
            NOT ST_IsEmpty(geometry::geometry) AND
            ST_X(geometry::geometry) BETWEEN 124 AND 132 AND
            ST_Y(geometry::geometry) BETWEEN 33 AND 39
        )
    )
);
CREATE INDEX idx_place_parent ON place (parent_id);
CREATE INDEX idx_place_geometry ON place USING GIST (geometry);

CREATE TABLE place_code_map (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    place_id text NOT NULL REFERENCES place (place_id),
    code_system text NOT NULL CHECK (code_system IN (
        'kosis', 'airkorea_station', 'airkorea_station_name', 'bjd', 'sgis'
    )),
    place_code text NOT NULL,
    valid_from date,
    valid_to date,
    CONSTRAINT ck_place_code_dates CHECK (
        valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to
    ),
    CONSTRAINT uq_place_code_start UNIQUE NULLS NOT DISTINCT (code_system, place_code, valid_from)
);
CREATE INDEX idx_place_code_map_place ON place_code_map (place_id);
