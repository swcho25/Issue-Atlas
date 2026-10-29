-- 논증 카드의 근거 하나 = 한 행. 판정(질문 실행)이 원본 · 정제 레코드에서 골라 만든다(S15P31C108-133).
-- 근거 하나는 원본 여러 건을 묶을 수 있다(예: KOSIS 3년치 순이동 → 근거 1건). 원본 위치는 locator 로 남긴다.
-- 출처 등급 · 이용허락 · 저장 범위는 근거를 만든 때의 값을 함께 둔다. 같은 실행 결과를 나중에도 같게 설명하기 위해서다.
CREATE TABLE evidence (
    evidence_id text PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('statistics', 'documents', 'existing_responses', 'denominators')),
    title text NOT NULL,
    source_id text NOT NULL REFERENCES source (source_id),
    source_grade text NOT NULL CHECK (source_grade IN ('A', 'B', 'C')),
    license_type text NOT NULL,
    storage_scope text NOT NULL CHECK (storage_scope IN ('full', 'metadata', 'link_only')),
    observed_at timestamptz,
    period_start date,
    period_end date,
    published_at timestamptz,
    collected_at timestamptz NOT NULL,
    location_precision text NOT NULL DEFAULT 'none'
        CHECK (location_precision IN ('exact', 'address', 'admin_centroid', 'none')),
    locator jsonb NOT NULL CHECK (jsonb_typeof(locator) = 'object'),
    -- 이용 허락 범위 안에서 보여 줄 내용. link_only 는 내용을 보여 주지 않는다(FR-E3)
    display text,
    url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_evidence_period CHECK (
        (period_start IS NULL) = (period_end IS NULL) AND (period_end IS NULL OR period_end > period_start)
    ),
    CONSTRAINT ck_evidence_link_only CHECK (storage_scope <> 'link_only' OR display IS NULL)
);
