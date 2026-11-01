-- 질문(지역 × 카드 × 기간)과 실행. 실행 하나 = 결과 하나이며 고치지 않는다(S15P31C108-133).
-- card_id null = 목록에 없는 질문(신규 카드 후보, FR-A3). 그 실행은 unsupported.
CREATE TABLE question (
    question_id text PRIMARY KEY,
    place_id text NOT NULL REFERENCES place (place_id),
    card_id text REFERENCES card (card_id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    raw_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (period_end > period_start)
);

-- result 는 GET /v1/arguments/{run_id} 응답(C2 argument) 그대로. 판(card · formula · taxonomy)도 그 안과 칸에 함께 둔다
CREATE TABLE argument_run (
    run_id text PRIMARY KEY,
    question_id text NOT NULL REFERENCES question (question_id),
    run_status text NOT NULL CHECK (run_status IN ('ready', 'partial', 'blocked', 'unsupported')),
    card_version integer CHECK (card_version >= 0),
    formula_version text,
    taxonomy_version text NOT NULL,
    result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
    created_at timestamptz NOT NULL
);
CREATE INDEX idx_argument_run_question ON argument_run (question_id);

-- 실행이 쓴 근거와 기존 대응 후보(판). 출처 등급이 없어 근거로 못 쓴 후보는 response_id 만 둔다
CREATE TABLE argument_run_source (
    run_id text NOT NULL REFERENCES argument_run (run_id),
    kind text NOT NULL CHECK (kind IN ('statistics', 'documents', 'existing_responses', 'denominators')),
    evidence_id text REFERENCES evidence (evidence_id),
    response_id text REFERENCES existing_response (response_id),
    CHECK (evidence_id IS NOT NULL OR response_id IS NOT NULL),
    UNIQUE NULLS NOT DISTINCT (run_id, kind, evidence_id, response_id)
);
