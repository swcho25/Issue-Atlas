-- P4 기사→카드 1차 분류. 원문 대신 제목·요약을 입력으로 보관한다.
CREATE TABLE document_search_input (
    input_id text PRIMARY KEY CHECK (input_id ~ '^dsi:[0-9a-f]{64}$'),
    doc_id text NOT NULL,
    news_id text NOT NULL REFERENCES news_event (news_id),
    raw_content_hash text NOT NULL REFERENCES raw_record (content_hash),
    input_version text NOT NULL,
    input_text text NOT NULL CHECK (btrim(input_text) <> ''),
    input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (news_id, raw_content_hash, input_version, input_hash),
    UNIQUE (input_id, doc_id),
    CONSTRAINT ck_document_search_input_doc_id CHECK (doc_id = 'news:' || news_id)
);
CREATE INDEX idx_document_search_input_doc ON document_search_input (doc_id, created_at DESC);

CREATE TABLE document_embedding_v1 (
    input_id text PRIMARY KEY REFERENCES document_search_input (input_id),
    doc_id text NOT NULL,
    model text NOT NULL,
    embedding vector(1536) NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    embedded_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (input_id, doc_id) REFERENCES document_search_input (input_id, doc_id),
    UNIQUE (input_id, doc_id)
);
CREATE UNIQUE INDEX uq_document_embedding_active_doc
    ON document_embedding_v1 (doc_id) WHERE is_active;

CREATE TABLE card_search_profile (
    card_id text NOT NULL,
    card_version integer NOT NULL,
    profile_version text NOT NULL,
    profile_text text NOT NULL CHECK (btrim(profile_text) <> ''),
    profile_hash text NOT NULL CHECK (profile_hash ~ '^[0-9a-f]{64}$'),
    model text NOT NULL,
    embedding vector(1536) NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    embedded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, card_version, profile_version),
    FOREIGN KEY (card_id, card_version) REFERENCES card_version (card_id, version)
);
CREATE UNIQUE INDEX uq_card_search_profile_active_card
    ON card_search_profile (card_id) WHERE is_active;

CREATE TABLE document_card_score (
    doc_id text NOT NULL,
    card_id text NOT NULL,
    input_id text NOT NULL,
    card_version integer NOT NULL,
    profile_version text NOT NULL,
    model text NOT NULL,
    cosine_similarity double precision NOT NULL CHECK (cosine_similarity BETWEEN -1 AND 1),
    threshold_version text NOT NULL,
    threshold double precision NOT NULL CHECK (threshold BETWEEN -1 AND 1),
    selected boolean NOT NULL,
    scored_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_id, card_id),
    FOREIGN KEY (input_id, doc_id) REFERENCES document_embedding_v1 (input_id, doc_id),
    FOREIGN KEY (card_id, card_version, profile_version)
        REFERENCES card_search_profile (card_id, card_version, profile_version),
    CONSTRAINT ck_document_card_score_selection
        CHECK (selected = (cosine_similarity >= threshold))
);
CREATE INDEX idx_document_card_score_selected
    ON document_card_score (card_id, selected, cosine_similarity DESC);
