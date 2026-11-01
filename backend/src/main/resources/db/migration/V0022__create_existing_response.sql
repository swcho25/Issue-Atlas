-- 카드 근거 ③ 「기존 대응」 후보(contracts/existing-response, S15P31C108-136). engine/pipeline/responses.py 가 채운다.
-- 한 행 = 원천 한 판 × 카드. 원천(온통청년 raw_record · 지방재정365 local_expenditure)은 고치지 않고 FK 로 잇는다.
-- 후보일 뿐 근거 확정이 아니다. 카드 · 지역 · 기간에 맞는지는 질문 실행(S15P31C108-133)이 판단한다.
CREATE TABLE existing_response (
    -- 'resp:' + sha256(카드 · 원천 · 판). 같은 판을 다시 넣어도 같은 행
    response_id text PRIMARY KEY CHECK (response_id ~ '^resp:[0-9a-f]{64}$'),
    card_id text NOT NULL REFERENCES card (card_id),
    origin text NOT NULL CHECK (origin IN ('youthcenter', 'lofin')),
    -- 판이 바뀌어도 같은 원천 식별자. 온통청년 '<plcyNo>:<zipCd>', 세출은 안정 식별자가 없어 expenditure_id
    origin_ref text NOT NULL,
    -- 원천 판. 온통청년은 원본 content_hash, 세출은 expenditure_id(내용 해시)
    raw_content_hash text REFERENCES raw_record (content_hash),
    expenditure_id text REFERENCES local_expenditure (expenditure_id),
    -- 원천의 지역 코드 그대로 · 맞춘 지역. 광주 본청(29)처럼 6곳에 없는 넓은 단위는 null
    place_code_raw text NOT NULL,
    place_id text REFERENCES place (place_id),
    name text NOT NULL,
    -- 원천에 없으면 null. 세출에는 담당 부서 열이 없다
    department text,
    -- 세출 회계연도. 사업 시행 기간과 다르다
    fiscal_year integer CHECK (fiscal_year BETWEEN 2000 AND 2100),
    -- 원천이 준 사업 기간 [start, end). 게시일 · 회계연도로 채우지 않는다
    period_start date,
    period_end date,
    target text,
    -- 칸 이름 → 채운 원천 칸 이름(없으면 null)
    field_sources jsonb NOT NULL CHECK (jsonb_typeof(field_sources) = 'object'),
    extracted_by text NOT NULL CHECK (extracted_by IN ('rule', 'llm')),
    selection_reason text NOT NULL,
    rule_version text NOT NULL,
    -- 같은 origin_ref 의 새 판이 들어오면 옛 행은 false
    is_current boolean NOT NULL DEFAULT true,
    extracted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_existing_response_origin CHECK (
        (origin = 'youthcenter' AND raw_content_hash IS NOT NULL AND expenditure_id IS NULL)
        OR (origin = 'lofin' AND expenditure_id IS NOT NULL AND raw_content_hash IS NULL)
    ),
    CONSTRAINT ck_existing_response_period CHECK (
        period_start IS NULL OR period_end IS NULL OR period_end > period_start
    )
);
CREATE INDEX idx_existing_response_card_place ON existing_response (card_id, place_id) WHERE is_current;
CREATE INDEX idx_existing_response_origin_ref ON existing_response (origin, origin_ref);
