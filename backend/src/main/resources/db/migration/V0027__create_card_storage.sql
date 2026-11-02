-- C3 저장 계약(S15P31C108-174). develop V0026 다음 번호. 병합 전 다른 MR과 겹치면 P7과 다시 조율.
-- V0013 메타 v1은 승인본이 아니다. 기존 실행/근거 버전은 유지하고 첫 실제 승인부터 v2.
ALTER TABLE card
    ADD COLUMN status text NOT NULL DEFAULT 'legacy'
        CHECK (status IN ('legacy', 'candidate', 'card', 'on_hold')),
    ADD COLUMN current_version integer,
    ADD COLUMN draft_spec jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(draft_spec) = 'object'),
    ADD COLUMN draft_revision bigint NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
    ADD COLUMN approved_draft_revision bigint,
    ADD COLUMN updated_by text,
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
    ADD CONSTRAINT ck_card_approved CHECK
        ((current_version IS NULL OR current_version = card_version)
         AND (status <> 'card' OR current_version IS NOT NULL));
ALTER TABLE card ALTER COLUMN status SET DEFAULT 'candidate';
ALTER TABLE card ALTER COLUMN card_version SET DEFAULT 0;

CREATE TABLE indicator (
    indicator_id text PRIMARY KEY,
    definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
    rule jsonb CHECK (jsonb_typeof(rule) = 'object'),
    rule_version integer NOT NULL DEFAULT 1 CHECK (rule_version > 0),
    numerator_id text REFERENCES indicator,
    denominator_id text REFERENCES indicator,
    base_id text REFERENCES indicator,
    added_by_card text REFERENCES card,
    status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified')),
    updated_by text NOT NULL CHECK (btrim(updated_by) <> ''),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((numerator_id IS NULL) = (denominator_id IS NULL)),
    CHECK (base_id IS NULL OR numerator_id IS NULL)
);

CREATE TABLE indicator_rule_history (
    indicator_id text NOT NULL REFERENCES indicator,
    rule_version integer NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (indicator_id, rule_version)
);

CREATE TABLE card_version (
    card_id text NOT NULL REFERENCES card,
    version integer NOT NULL CHECK (version > 0),
    spec jsonb NOT NULL CHECK (jsonb_typeof(spec) = 'object'),
    draft_revision bigint NOT NULL,
    approved_by text NOT NULL CHECK (btrim(approved_by) <> ''),
    approved_at timestamptz NOT NULL DEFAULT now(),
    created_tx xid8 NOT NULL DEFAULT pg_current_xact_id(),
    PRIMARY KEY (card_id, version)
);
ALTER TABLE card ADD CONSTRAINT fk_card_current_version
    FOREIGN KEY (card_id, current_version) REFERENCES card_version(card_id, version);

CREATE TABLE card_claim_item (
    card_id text NOT NULL,
    version integer NOT NULL,
    item_order smallint NOT NULL CHECK (item_order BETWEEN 1 AND 3),
    indicator_id text NOT NULL REFERENCES indicator,
    role text NOT NULL CHECK (role IN ('main', 'related')),
    rule_version integer NOT NULL,
    PRIMARY KEY (card_id, version, item_order),
    UNIQUE (card_id, version, indicator_id),
    FOREIGN KEY (card_id, version) REFERENCES card_version,
    FOREIGN KEY (indicator_id, rule_version) REFERENCES indicator_rule_history
);
CREATE UNIQUE INDEX idx_card_main_indicator ON card_claim_item(card_id, version) WHERE role = 'main';

CREATE TABLE card_evidence_policy (
    card_id text NOT NULL,
    version integer NOT NULL,
    kind text NOT NULL CHECK (kind IN ('statistics', 'documents', 'existing_responses', 'denominators')),
    required boolean NOT NULL,
    PRIMARY KEY (card_id, version, kind),
    FOREIGN KEY (card_id, version) REFERENCES card_version
);
CREATE TABLE card_evidence_bind (
    card_id text NOT NULL,
    version integer NOT NULL,
    kind text NOT NULL,
    seq integer NOT NULL CHECK (seq > 0),
    spec_id text,
    binding jsonb NOT NULL CHECK (jsonb_typeof(binding) = 'object'),
    PRIMARY KEY (card_id, version, kind, seq),
    FOREIGN KEY (card_id, version, kind) REFERENCES card_evidence_policy
);
-- 미등록 수집 명세도 명시적인 결측 설명과 함께 저장한다. 실제 evidence 행과 구분.
CREATE TABLE card_rebuttal (
    card_id text NOT NULL,
    version integer NOT NULL,
    rebuttal_id text NOT NULL,
    seq integer NOT NULL CHECK (seq > 0),
    definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
    PRIMARY KEY (card_id, version, rebuttal_id),
    UNIQUE (card_id, version, seq),
    FOREIGN KEY (card_id, version) REFERENCES card_version
);
CREATE TABLE card_revision (
    revision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    card_id text NOT NULL REFERENCES card,
    from_version integer NOT NULL CHECK (from_version >= 0),
    to_version integer NOT NULL,
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    approved_by text NOT NULL CHECK (btrim(approved_by) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (card_id, to_version),
    FOREIGN KEY (card_id, to_version) REFERENCES card_version(card_id, version),
    CHECK (to_version = from_version + 1)
);

