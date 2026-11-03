-- S15P31C108-216. 기사 카드 꼬리표 작업의 V0036 다음에 적용한다.
CREATE TABLE review_request (
    review_id text PRIMARY KEY,
    origin text NOT NULL CHECK (origin IN ('user','admin','local_import','model')),
    target_type text NOT NULL CHECK (target_type IN ('news_event','normalized_record','press_release','source','card')),
    target_id text NOT NULL,
    issue_type text NOT NULL CHECK (issue_type IN ('location','classification','duplicate','value','wording','metadata','other')),
    card_id text REFERENCES card,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
    proposed_value jsonb CHECK (proposed_value IS NULL OR jsonb_typeof(proposed_value)='object'),
    submitted_value jsonb NOT NULL CHECK (jsonb_typeof(submitted_value)='object'),
    submitted_by bigint NOT NULL REFERENCES app_user,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','on_hold','resolved','rejected','approval_pending')),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
    approval_request_id text REFERENCES card_approval_request,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((status='approval_pending')=(approval_request_id IS NOT NULL)),
    CHECK (target_type <> 'card' OR card_id IS NOT DISTINCT FROM target_id)
);
CREATE INDEX idx_review_queue ON review_request(status,created_at DESC,review_id);
CREATE INDEX idx_review_target ON review_request(target_type,target_id);

CREATE TABLE review_change (
    change_id text PRIMARY KEY,
    review_id text NOT NULL REFERENCES review_request,
    action text NOT NULL CHECK (action IN ('confirm','correct','hold','reject')),
    scope text NOT NULL CHECK (scope IN ('record','source','card')),
    actor_id bigint NOT NULL REFERENCES app_user,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
    before_value jsonb NOT NULL CHECK (jsonb_typeof(before_value)='object'),
    after_value jsonb NOT NULL CHECK (jsonb_typeof(after_value)='object'),
    revision bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(review_id,revision)
);
CREATE INDEX idx_review_change_time ON review_change(created_at DESC,change_id);
CREATE FUNCTION protect_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'review audit is append only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER protect_review_change BEFORE UPDATE OR DELETE ON review_change
    FOR EACH ROW EXECUTE FUNCTION protect_review_audit();
