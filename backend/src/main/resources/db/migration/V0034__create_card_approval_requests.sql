-- S15P31C108-205. V0033은 질문 실행 이력 MR에서 사용 중. 병합 전에 번호를 조율한다.
-- 공개 card.status와 별도로 요청 상태를 관리하여 승인 대기 중 기존 승인본을 보존한다.
CREATE TABLE card_approval_request (
    request_id text PRIMARY KEY,
    card_id text NOT NULL REFERENCES card,
    draft_revision bigint NOT NULL CHECK (draft_revision >= 0),
    draft_spec jsonb NOT NULL CHECK (jsonb_typeof(draft_spec) = 'object'),
    indicator_versions jsonb NOT NULL CHECK (jsonb_typeof(indicator_versions) = 'object'),
    requested_by bigint NOT NULL REFERENCES app_user,
    approver_id bigint NOT NULL REFERENCES app_user,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','on_hold','approved','rejected')),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_by bigint REFERENCES app_user,
    decided_at timestamptz,
    decision_reason text,
    approved_version integer,
    FOREIGN KEY (card_id, approved_version) REFERENCES card_version(card_id, version),
    CHECK ((status = 'approved') = (approved_version IS NOT NULL)),
    CHECK ((status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
        OR (status <> 'pending' AND decided_by IS NOT NULL AND decided_by = approver_id
            AND decided_at IS NOT NULL AND decision_reason IS NOT NULL
            AND length(btrim(decision_reason)) BETWEEN 1 AND 2000))
);
CREATE UNIQUE INDEX uq_card_open_approval ON card_approval_request(card_id)
    WHERE status IN ('pending','on_hold');
CREATE INDEX idx_card_approval_queue ON card_approval_request(approver_id, status, created_at DESC);

CREATE TABLE card_approval_decision (
    decision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id text NOT NULL REFERENCES card_approval_request,
    actor_id bigint NOT NULL REFERENCES app_user,
    decision text NOT NULL CHECK (decision IN ('approve','reject','hold')),
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_approval_decisions ON card_approval_decision(request_id, decision_id);

CREATE FUNCTION protect_requested_card_draft() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.draft_spec IS DISTINCT FROM OLD.draft_spec OR NEW.draft_revision <> OLD.draft_revision)
       AND EXISTS (SELECT FROM card_approval_request WHERE card_id = OLD.card_id
                   AND status IN ('pending','on_hold')) THEN
        RAISE EXCEPTION 'open approval request locks draft' USING ERRCODE = '40001';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_requested_card_draft BEFORE UPDATE ON card
    FOR EACH ROW EXECUTE FUNCTION protect_requested_card_draft();
