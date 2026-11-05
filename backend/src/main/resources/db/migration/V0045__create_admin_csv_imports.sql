-- S15P31C108-236: V0044 보도자료 옛 표 삭제 다음. 업로드 보관과 처리 기록만 추가한다.
CREATE TABLE csv_import_request (
    import_id text PRIMARY KEY,
    requested_by bigint NOT NULL REFERENCES app_user,
    assignee_id bigint NOT NULL REFERENCES app_user,
    request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
    fingerprint text NOT NULL,
    file_name text NOT NULL,
    file_sha256 text NOT NULL,
    file_data bytea NOT NULL CHECK (octet_length(file_data) BETWEEN 1 AND 2097152),
    template_version text NOT NULL CHECK (template_version='1'),
    status text NOT NULL CHECK (status IN ('validation_failed','no_changes','pending','completed','failed')),
    validation jsonb NOT NULL CHECK (jsonb_typeof(validation)='object'),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(requested_by,request_key)
);
CREATE INDEX idx_csv_import_queue ON csv_import_request(status,created_at DESC,import_id);
CREATE TABLE csv_import_result (
    import_id text PRIMARY KEY REFERENCES csv_import_request,
    actor_id bigint NOT NULL REFERENCES app_user,
    status text NOT NULL CHECK (status IN ('completed','failed')),
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
    loaded_rows integer NOT NULL CHECK (loaded_rows>=0),
    skipped_rows integer NOT NULL CHECK (skipped_rows>=0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER protect_csv_import_result BEFORE UPDATE OR DELETE ON csv_import_result
    FOR EACH ROW EXECUTE FUNCTION protect_review_audit();
