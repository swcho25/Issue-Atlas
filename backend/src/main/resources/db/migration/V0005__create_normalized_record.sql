-- P2 정제 결과(contracts/p2). 번호 V0005: V0003 은 core-schema 몫으로 비어 있어 건너뛴다.

-- 장부: 수집기(P1)가 원본에서 만든 C1 레코드. P1 이 원본과 같은 행에 채우고 P2 는 읽기만 한다.
-- 이 칸이 생기기 전에 저장된 원본은 null 이다(정제에서 건너뛴다).
ALTER TABLE raw_record ADD COLUMN c1_record jsonb
    CHECK (c1_record IS NULL OR jsonb_typeof(c1_record) = 'object');

-- 장부 한 행을 정제한 결과 하나가 한 행이다.
CREATE TABLE normalized_record (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 원본 찾기. 같은 dedup_key 라도 내용이 다른 원본(충돌)은 각자 한 행으로 남는다.
    content_hash text NOT NULL UNIQUE REFERENCES raw_record (content_hash),
    dedup_key text,
    source_id text NOT NULL,
    spec_id text NOT NULL,
    -- 다음 단계가 거르는 C1 칸. held 는 C1 을 어길 수 있어 record 에만 두고 여기는 비운다.
    indicator_id text,
    place_code_system text,
    place_code_raw text,
    observed_period_type text,
    observed_period_start timestamptz,
    observed_period_end timestamptz,
    observed_at timestamptz,
    value numeric,
    unit text,
    missing_reason text CHECK (missing_reason IN ('not_published', 'not_collected', 'license_blocked')),
    storage_scope text CHECK (storage_scope IN ('full', 'metadata', 'link_only')),
    -- P2 칸
    validation_status text NOT NULL CHECK (validation_status IN ('pass', 'fixed', 'held')),
    issues jsonb NOT NULL CHECK (jsonb_typeof(issues) = 'array'),
    rule_version text NOT NULL CHECK (rule_version LIKE 'p2-%'),
    obs_key text CHECK (obs_key ~ '^obs:[0-9a-f]{64}$'),
    is_latest boolean,
    -- 정제 레코드 전체(C1 칸 + P2 칸). 위 칸은 모두 여기서 꺼낸 값이다.
    record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
    -- 이 행의 정제 결과가 마지막으로 바뀐 시각. 같은 결과로 다시 돌리면 바뀌지 않는다.
    refined_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_normalized_latest_pair CHECK ((obs_key IS NULL) = (is_latest IS NULL)),
    CONSTRAINT ck_normalized_ready_fields CHECK (
        validation_status = 'held' OR (
            place_code_system IS NOT NULL AND place_code_raw IS NOT NULL
            AND observed_period_type IS NOT NULL AND storage_scope IS NOT NULL
        )
    )
);
CREATE INDEX idx_normalized_record_dedup_key ON normalized_record (dedup_key);
CREATE INDEX idx_normalized_record_obs_key ON normalized_record (obs_key);
CREATE INDEX idx_normalized_record_spec ON normalized_record (spec_id);

-- 다음 단계(P3 지역·시간, P4 분류)가 읽는 행: 보류가 아니고, 관측값은 최신본만(메타 레코드는 is_latest 가 null).
CREATE VIEW normalized_ready AS
SELECT * FROM normalized_record
WHERE validation_status IN ('pass', 'fixed') AND is_latest IS NOT FALSE;
