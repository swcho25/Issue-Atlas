-- C3 승인 함수·불변성. V0027 저장 구조와 함께 배포한다.
CREATE FUNCTION card_nonblank(j jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT coalesce(jsonb_typeof(j) = 'string' AND length(btrim(j #>> '{}')) > 0, false)
$$;
CREATE FUNCTION card_string_array(j jsonb, minimum integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF jsonb_typeof(j) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    RETURN jsonb_array_length(j) >= minimum
        AND NOT EXISTS (SELECT FROM jsonb_array_elements(j) x WHERE NOT card_nonblank(x));
END $$;

-- 사전 정의는 #171 키를 보존하며 target/shape 및 파생 지표 필드를 추가한다.
CREATE FUNCTION indicator_validate_and_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d jsonb := NEW.definition; r jsonb := NEW.rule; shape text;
BEGIN
    IF NOT coalesce(d->>'id' = NEW.indicator_id, false)
       OR NOT (card_nonblank(d->'label') AND card_nonblank(d->'unit') AND card_nonblank(d->'target'))
       OR NOT coalesce(d->>'period_type' IN ('Y','M'), false)
       OR NOT coalesce(d->>'place_level' IN ('sigungu','emd','station','sigungu_pair'), false)
       OR NOT coalesce(d->'roll'->>'method' IN ('sum','mean','end_of_period'), false)
       OR jsonb_typeof(d->'source') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid indicator definition' USING ERRCODE = '23514';
    END IF;
    IF d->'roll'->>'method' IN ('sum','mean') THEN
        IF NOT coalesce((d->'roll'->>'min_months') ~ '^([1-9]|1[0-2])$', false) THEN
            RAISE EXCEPTION 'invalid roll min_months' USING ERRCODE = '23514';
        END IF;
    END IF;
    shape := coalesce(d->>'shape', 'value');
    IF shape NOT IN ('value','flow','ratio','grade_days')
       OR (shape = 'ratio') <> (NEW.numerator_id IS NOT NULL AND NEW.denominator_id IS NOT NULL)
       OR (shape = 'grade_days') <> (NEW.base_id IS NOT NULL) THEN
        RAISE EXCEPTION 'invalid indicator dependencies' USING ERRCODE = '23514';
    END IF;
    IF shape = 'ratio' THEN
        IF jsonb_typeof(d->'multiplier') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'ratio multiplier required' USING ERRCODE = '23514';
        END IF;
    ELSIF shape = 'grade_days' THEN
        IF jsonb_typeof(d->'cut') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'grade boundary required' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF r IS NOT NULL AND (
        NOT card_nonblank(r->'rule_id') OR NOT card_nonblank(r->'formula_version')
        OR jsonb_typeof(r->'thresholds') IS DISTINCT FROM 'object'
        OR jsonb_typeof(r->'outcomes') IS DISTINCT FROM 'array'
    ) THEN RAISE EXCEPTION 'invalid indicator rule' USING ERRCODE = '23514'; END IF;
    IF r IS NOT NULL THEN
        IF jsonb_array_length(r->'outcomes') = 0 OR EXISTS (
            SELECT FROM jsonb_array_elements(r->'outcomes') x
            WHERE NOT card_nonblank(x->'when') OR NOT card_nonblank(x->'label')
                OR NOT coalesce(x->>'claim' IN ('increasing','decreasing','unclear','insufficient','not_comparable'), false)
        ) THEN RAISE EXCEPTION 'invalid rule outcomes' USING ERRCODE = '23514'; END IF;
    END IF;
    IF TG_OP = 'INSERT' THEN NEW.rule_version := 1;
    ELSE
        IF NEW.indicator_id <> OLD.indicator_id THEN
            RAISE EXCEPTION 'indicator identity is immutable' USING ERRCODE = '23514';
        END IF;
        NEW.rule_version := OLD.rule_version + CASE WHEN
            ROW(NEW.definition, NEW.rule, NEW.numerator_id, NEW.denominator_id, NEW.base_id)
            IS DISTINCT FROM ROW(OLD.definition, OLD.rule, OLD.numerator_id, OLD.denominator_id, OLD.base_id)
            THEN 1 ELSE 0 END;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END $$;
CREATE TRIGGER trg_indicator_validate BEFORE INSERT OR UPDATE ON indicator
    FOR EACH ROW EXECUTE FUNCTION indicator_validate_and_version();
CREATE FUNCTION indicator_log() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.rule_version <> OLD.rule_version THEN
        INSERT INTO indicator_rule_history(indicator_id, rule_version, snapshot, changed_by)
        VALUES (NEW.indicator_id, NEW.rule_version, to_jsonb(NEW), NEW.updated_by);
    END IF;
    RETURN NULL;
END $$;
CREATE TRIGGER trg_indicator_log AFTER INSERT OR UPDATE ON indicator
    FOR EACH ROW EXECUTE FUNCTION indicator_log();

CREATE FUNCTION card_storage_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'approved snapshot/history is immutable' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_version FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_claim_item FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_evidence_policy FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_evidence_bind FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_rebuttal FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON card_revision FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();
CREATE TRIGGER trg_frozen BEFORE UPDATE OR DELETE ON indicator_rule_history FOR EACH ROW EXECUTE FUNCTION card_storage_frozen();

-- 현재 버전 포인터를 되돌려도 이미 승인된 버전은 다시 열리지 않는다.
CREATE FUNCTION card_storage_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT FROM card_revision WHERE card_id = NEW.card_id AND to_version = NEW.version)
       OR NOT EXISTS (SELECT FROM card_version WHERE card_id = NEW.card_id AND version = NEW.version
                       AND created_tx = pg_current_xact_id()) THEN
        RAISE EXCEPTION 'approved version is closed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_closed BEFORE INSERT ON card_claim_item FOR EACH ROW EXECUTE FUNCTION card_storage_closed();
CREATE TRIGGER trg_closed BEFORE INSERT ON card_evidence_policy FOR EACH ROW EXECUTE FUNCTION card_storage_closed();
CREATE TRIGGER trg_closed BEFORE INSERT ON card_evidence_bind FOR EACH ROW EXECUTE FUNCTION card_storage_closed();
CREATE TRIGGER trg_closed BEFORE INSERT ON card_rebuttal FOR EACH ROW EXECUTE FUNCTION card_storage_closed();

-- 승인 트랜잭션에서 만든 미완성 헤더만 따로 커밋되는 것을 막는다.
CREATE FUNCTION card_version_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT FROM card_revision WHERE card_id = NEW.card_id AND to_version = NEW.version)
       OR (SELECT count(*) FROM card_evidence_policy WHERE card_id = NEW.card_id AND version = NEW.version) <> 4
       OR (SELECT count(*) FROM card_claim_item WHERE card_id = NEW.card_id AND version = NEW.version AND role = 'main') <> 1 THEN
        RAISE EXCEPTION 'incomplete approval' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_complete AFTER INSERT ON card_version
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION card_version_complete();

-- 임의 JSON 입력에도 예외 대신 항목별 false를 반환한다. 승인 함수도 동일 검사를 사용한다.
CREATE FUNCTION card_spec_check(s jsonb)
RETURNS TABLE(check_no integer, ok boolean, label text) LANGUAGE plpgsql STABLE AS $$
DECLARE items jsonb; ev jsonb; main_id text; target text; claim text; rb jsonb; k text;
BEGIN
    check_no := 0; label := 'JSON 객체 및 카드 기본 정보';
    ok := jsonb_typeof(s) = 'object' AND card_nonblank(s->'name') AND card_nonblank(s->'domain')
        AND card_nonblank(s->'parent_question') AND card_nonblank(s->'author');
    ok := coalesce(ok, false); RETURN NEXT;
    claim := coalesce(s->>'claim_template', '');
    check_no := 1; label := '판단 문장: 판정값 한 개, 원인·효과 단정 없음';
    ok := (length(claim) - length(replace(claim, '{판정값}', ''))) / length('{판정값}') = 1
        AND regexp_replace(claim, '(원인|효과)[은는을를이가]?\s*(판단|말|주장|단정)하지\s*않', '', 'g') !~ '(원인|때문에|효과|소멸)';
    RETURN NEXT;
    check_no := 2; label := '근거 4종 및 필수 정책'; ok := true;
    FOREACH k IN ARRAY ARRAY['statistics','documents','existing_responses','denominators'] LOOP
        ev := s->'evidence'->k;
        IF jsonb_typeof(ev) IS DISTINCT FROM 'array' THEN ok := false;
        ELSE
            ok := ok AND jsonb_array_length(ev) > 0 AND NOT EXISTS (
                SELECT FROM jsonb_array_elements(ev) x
                WHERE jsonb_typeof(x) <> 'object'
                   OR NOT (card_nonblank(x->'spec_id') OR card_nonblank(x->'none_reason') OR card_nonblank(x->'note'))
                   OR (x ? 'spec_id' AND jsonb_typeof(x->'spec_id') NOT IN ('string','null')));
        END IF;
        ok := ok AND coalesce(s->'required_for_claim'->>k IN ('required','optional'), false);
    END LOOP;
    RETURN NEXT;
    check_no := 3; label := '승인 가능한 보증 및 경쟁 설명 2개 이상';
    rb := s->'rebuttals'->'items';
    ok := card_nonblank(s->'warrant'->'text') AND s->'warrant'->>'status' IN ('draft','approved');
    IF jsonb_typeof(rb) IS DISTINCT FROM 'array' THEN ok := false;
    ELSE
        ok := ok AND s->'rebuttals'->>'status' IN ('draft','approved') AND jsonb_array_length(rb) >= 2
            AND NOT EXISTS (SELECT FROM jsonb_array_elements(rb) x
                WHERE NOT card_nonblank(x->'id') OR NOT card_nonblank(x->'text'))
            AND (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(rb) x) = jsonb_array_length(rb);
    END IF;
    ok := coalesce(ok, false); RETURN NEXT;
    check_no := 4; label := '비교 조건 4가지';
    ok := (SELECT bool_and(card_nonblank(s->'comparability'->c)) FROM unnest(
        ARRAY['same_indicator','same_period_length','same_boundary','same_method']) c);
    RETURN NEXT;
    check_no := 5; label := '시공간 유형과 상한선';
    ok := card_string_array(s->'st_type', 1) AND card_string_array(s->'ceiling', 1);
    IF ok THEN ok := NOT EXISTS (SELECT FROM jsonb_array_elements_text(s->'st_type') t
        WHERE t NOT IN ('분포형','변화형','이동형','사건형')); END IF;
    RETURN NEXT;
    check_no := 6; label := '사전 지표 1~3개, 주 지표 1개 및 판정 규칙';
    items := s->'claim_items'; ok := false;
    IF jsonb_typeof(items) = 'array' THEN
        ok := jsonb_array_length(items) BETWEEN 1 AND 3
            AND (SELECT count(*) FROM jsonb_array_elements(items) x WHERE x->>'role' = 'main') = 1
            AND NOT EXISTS (SELECT FROM jsonb_array_elements(items) x
                WHERE NOT coalesce(x->>'role' IN ('main','related'), false)
                   OR NOT EXISTS (SELECT FROM indicator WHERE indicator_id = x->>'indicator_id'))
            AND (SELECT count(DISTINCT x->>'indicator_id') FROM jsonb_array_elements(items) x) = jsonb_array_length(items);
        SELECT x->>'indicator_id' INTO main_id FROM jsonb_array_elements(items) x WHERE x->>'role' = 'main' LIMIT 1;
        ok := ok AND EXISTS (SELECT FROM indicator WHERE indicator_id = main_id AND rule IS NOT NULL);
    END IF;
    RETURN NEXT;
    check_no := 7; label := '판단 문장·적용 대상과 주 지표의 연령 일치';
    SELECT definition->>'target' INTO target FROM indicator WHERE indicator_id = main_id;
    ok := main_id IS NOT NULL AND target IS NOT NULL
        AND (regexp_match(claim, '(\d+)\s*[–~-]\s*(\d+)\s*세') IS NULL
             OR regexp_match(claim, '(\d+)\s*[–~-]\s*(\d+)\s*세') = regexp_match(target, '(\d+)\s*[–~-]\s*(\d+)\s*세'))
        AND coalesce(s->'applicability'->>'population' = target, false);
    ok := coalesce(ok, false); RETURN NEXT;
    check_no := 8; label := '적용 조건·허용 판단 수준·선택 필드';
    ok := coalesce(s->'applicability'->>'place_level' IN ('sigungu','emd','station','sigungu_pair'), false)
        AND coalesce((s->'applicability'->>'min_complete_years') ~ '^[1-9][0-9]*$', false)
        AND coalesce(s->>'max_claim_level' IN ('observed_fact','calculated','associated','insufficient_evidence'), false)
        AND card_string_array(coalesce(s->'inclusion','[]')) AND card_string_array(coalesce(s->'exclusion','[]'))
        AND card_string_array(coalesce(s->'keywords','[]')) AND card_string_array(coalesce(s->'forbidden_terms','[]'))
        AND jsonb_typeof(coalesce(s->'expected_gaps','[]')) = 'array';
    RETURN NEXT;
END $$;

CREATE FUNCTION approve_card(p_card_id text, p_approved_by text, p_draft_revision bigint, p_reason text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE c card%ROWTYPE; ids text[]; all_ids text[]; main_id text; v integer; s jsonb; snapshots jsonb;
BEGIN
    SELECT * INTO c FROM card WHERE card_id = p_card_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002'; END IF;
    IF c.draft_revision <> p_draft_revision OR c.approved_draft_revision = p_draft_revision THEN
        RAISE EXCEPTION 'stale or already approved draft' USING ERRCODE = '40001';
    END IF;
    IF btrim(coalesce(p_approved_by,'')) = '' OR btrim(coalesce(p_reason,'')) = '' THEN
        RAISE EXCEPTION 'actor and reason required' USING ERRCODE = '23514';
    END IF;
    -- 지표 변경과 승인 스냅샷이 교차하지 않도록 짧은 승인 동안 사전을 읽기 잠근다.
    LOCK TABLE indicator IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (SELECT FROM card_spec_check(c.draft_spec) WHERE ok IS NOT TRUE)
       OR left(c.draft_spec->>'domain', 1) <> left(p_card_id, 1) THEN
        RAISE EXCEPTION 'card validation failed' USING ERRCODE = '23514';
    END IF;
    SELECT array_agg(x->>'indicator_id' ORDER BY n) INTO ids
        FROM jsonb_array_elements(c.draft_spec->'claim_items') WITH ORDINALITY t(x,n);
    SELECT x->>'indicator_id' INTO main_id FROM jsonb_array_elements(c.draft_spec->'claim_items') x WHERE x->>'role' = 'main';
    -- 아래 의존성 수집(UNION)은 순환이 있어도 멈춘다. 순환 자체는 여기서 path로 찾아 거절한다.
    IF EXISTS (WITH RECURSIVE walk(id,path,cycle) AS (
        SELECT unnest(ids), ARRAY[]::text[], false
        UNION ALL SELECT dep, path || w.id, dep = ANY(path || w.id)
        FROM walk w JOIN indicator i ON i.indicator_id = w.id
        CROSS JOIN LATERAL unnest(ARRAY[i.numerator_id,i.denominator_id,i.base_id]) dep
        WHERE dep IS NOT NULL AND NOT cycle
    ) SELECT FROM walk WHERE cycle) THEN
        RAISE EXCEPTION 'cyclic indicator dependency' USING ERRCODE = '23514';
    END IF;
    WITH RECURSIVE used(id) AS (
        SELECT unnest(ids) UNION SELECT dep FROM used u JOIN indicator i ON i.indicator_id = u.id
        CROSS JOIN LATERAL unnest(ARRAY[i.numerator_id,i.denominator_id,i.base_id]) dep WHERE dep IS NOT NULL
    ) SELECT array_agg(id ORDER BY id) INTO all_ids FROM used;
    IF EXISTS (SELECT FROM indicator WHERE indicator_id = ANY(all_ids) AND status = 'unverified'
               AND added_by_card IS DISTINCT FROM p_card_id) THEN
        RAISE EXCEPTION 'unverified external indicator' USING ERRCODE = '23514';
    END IF;
    UPDATE indicator SET status = 'verified', updated_by = p_approved_by
        WHERE indicator_id = ANY(all_ids) AND added_by_card = p_card_id AND status = 'unverified';
    SELECT jsonb_agg(to_jsonb(i) ORDER BY indicator_id) INTO snapshots FROM indicator i WHERE indicator_id = ANY(all_ids);
    v := c.card_version + 1;
    s := c.draft_spec || jsonb_build_object('card_id',p_card_id,'card_version',v,'status','card',
        'taxonomy_version',c.taxonomy_version,'indicator_snapshots',snapshots,
        'rule',(SELECT rule || jsonb_build_object('indicator_id',main_id,'rule_version',rule_version)
                FROM indicator WHERE indicator_id = main_id),
        'warrant',c.draft_spec->'warrant' || '{"status":"approved"}'::jsonb,
        'rebuttals',c.draft_spec->'rebuttals' || '{"status":"approved"}'::jsonb,
        'approval',jsonb_build_object('approved_by',p_approved_by,'approved_at',now(),'reason',p_reason));
    INSERT INTO card_version(card_id,version,spec,draft_revision,approved_by)
        VALUES(p_card_id,v,s,c.draft_revision,p_approved_by);
    INSERT INTO card_claim_item(card_id,version,item_order,indicator_id,role,rule_version)
        SELECT p_card_id,v,n,x->>'indicator_id',x->>'role',i.rule_version
        FROM jsonb_array_elements(s->'claim_items') WITH ORDINALITY t(x,n)
        JOIN indicator i ON i.indicator_id = x->>'indicator_id';
    INSERT INTO card_evidence_policy(card_id,version,kind,required)
        SELECT p_card_id,v,k,s->'required_for_claim'->>k = 'required'
        FROM unnest(ARRAY['statistics','documents','existing_responses','denominators']) k;
    INSERT INTO card_evidence_bind(card_id,version,kind,seq,spec_id,binding)
        SELECT p_card_id,v,k,n,x->>'spec_id',x
        FROM unnest(ARRAY['statistics','documents','existing_responses','denominators']) k
        CROSS JOIN LATERAL jsonb_array_elements(s->'evidence'->k) WITH ORDINALITY t(x,n);
    INSERT INTO card_rebuttal(card_id,version,rebuttal_id,seq,definition)
        SELECT p_card_id,v,x->>'id',n,x FROM jsonb_array_elements(s->'rebuttals'->'items') WITH ORDINALITY t(x,n);
    INSERT INTO card_revision(card_id,from_version,to_version,reason,approved_by)
        VALUES(p_card_id,c.card_version,v,p_reason,p_approved_by);
    UPDATE card SET name = s->>'name', domain = s->>'domain', parent_question = s->>'parent_question',
        card_version = v, current_version = v, status = 'card', approved_draft_revision = draft_revision,
        updated_by = p_approved_by, updated_at = now() WHERE card_id = p_card_id;
    RETURN v;
END $$;

CREATE VIEW v_card_usable AS
    SELECT c.card_id, v.version, v.spec FROM card c JOIN card_version v
    ON v.card_id = c.card_id AND v.version = c.current_version WHERE c.status = 'card';
