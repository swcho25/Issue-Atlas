-- MR !86 리뷰(박준우): #171 카드 설계도(contracts/cards)의 지표 6개와 A3가 V0028 검사에서 막히던 것을 고친다.
-- V0028은 병합 · 적용됐으므로 고치지 않고 같은 이름 · 같은 시그니처의 함수를 다시 정의한다. 표 · 트리거는 그대로.
-- 바뀐 점: 지표 target 선택 · place_level #171과 통일 · 규칙 indicator_id와 마지막 otherwise · 공통+카드 금지어 ·
-- 근거 null + note · 연령은 지표 ID 기준 · max_claim_level 3종 · 검사 9(map_mode · legend_text) · 저장 승인 기록 card_approval.

-- 사전 정의는 #171 키를 보존하며 shape 및 파생 지표 필드를 추가한다. target은 설명용 선택 칸이고 연령은 지표 ID(_19_39)가 원본.
CREATE OR REPLACE FUNCTION indicator_validate_and_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d jsonb := NEW.definition; r jsonb := NEW.rule; shape text;
BEGIN
    IF NOT coalesce(d->>'id' = NEW.indicator_id, false)
       OR NOT (card_nonblank(d->'label') AND card_nonblank(d->'unit'))
       OR (d ? 'target' AND NOT card_nonblank(d->'target'))
       OR NOT coalesce(d->>'period_type' IN ('Y','M'), false)
       OR NOT coalesce(d->>'place_level' IN ('sido','sigungu','emd','station'), false)
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
    -- #171 규칙: rule.indicator_id는 이 지표(= 카드의 main), outcomes는 위에서부터 처음 맞는 것이고 마지막은 otherwise.
    IF r IS NOT NULL AND (
        NOT card_nonblank(r->'rule_id') OR NOT card_nonblank(r->'formula_version')
        OR jsonb_typeof(r->'thresholds') IS DISTINCT FROM 'object'
        OR jsonb_typeof(r->'outcomes') IS DISTINCT FROM 'array'
        OR (r ? 'indicator_id' AND r->>'indicator_id' IS DISTINCT FROM NEW.indicator_id)
    ) THEN RAISE EXCEPTION 'invalid indicator rule' USING ERRCODE = '23514'; END IF;
    IF r IS NOT NULL THEN
        IF jsonb_array_length(r->'outcomes') = 0 OR EXISTS (
            SELECT FROM jsonb_array_elements(r->'outcomes') x
            WHERE NOT card_nonblank(x->'when') OR NOT card_nonblank(x->'label')
                OR NOT coalesce(x->>'claim' IN ('increasing','decreasing','unclear','insufficient','not_comparable'), false)
        ) OR r->'outcomes'->-1->>'when' IS DISTINCT FROM 'otherwise'
        THEN RAISE EXCEPTION 'invalid rule outcomes' USING ERRCODE = '23514'; END IF;
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

-- 임의 JSON 입력에도 예외 대신 항목별 false를 반환한다. 승인 함수도 동일 검사를 사용한다.
CREATE OR REPLACE FUNCTION card_spec_check(s jsonb)
RETURNS TABLE(check_no integer, ok boolean, label text) LANGUAGE plpgsql STABLE AS $$
DECLARE items jsonb; ev jsonb; main_id text; claim text; rb jsonb; k text; terms text[];
    age_pattern constant text := '(\d+)\s*[–~-]\s*(\d+)\s*세';
BEGIN
    check_no := 0; label := 'JSON 객체 및 카드 기본 정보';
    ok := jsonb_typeof(s) = 'object' AND card_nonblank(s->'name') AND card_nonblank(s->'domain')
        AND card_nonblank(s->'parent_question') AND card_nonblank(s->'author');
    ok := coalesce(ok, false); RETURN NEXT;
    claim := coalesce(s->>'claim_template', '');
    -- 양식 E3: 공통 금지어(확산·전파·원인·효과·소멸) + 카드 forbidden_terms. 「원인은 판단하지 않음」 같은 부정문은 허용.
    terms := ARRAY['확산','전파','원인','효과','소멸','때문에'] || coalesce(ARRAY(
        SELECT btrim(x) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(s->'forbidden_terms') = 'array'
            THEN s->'forbidden_terms' ELSE '[]' END) x WHERE btrim(x) <> ''), '{}');
    check_no := 1; label := '판단 문장: 판정값 한 개, 공통·카드 금지어 없음';
    ok := (length(claim) - length(replace(claim, '{판정값}', ''))) / length('{판정값}') = 1
        AND NOT EXISTS (SELECT FROM unnest(terms) t WHERE strpos(
            regexp_replace(claim, '\S+?[은는을를이가]?\s*(판단|말|주장|단정)하지\s*않\S*', '', 'g'), t) > 0);
    RETURN NEXT;
    -- 양식 C: 근거 4종은 비우지 않는다. 소스가 없으면 #171처럼 spec_id null + note(없음 사유).
    check_no := 2; label := '근거 4종 및 필수 정책'; ok := true;
    FOREACH k IN ARRAY ARRAY['statistics','documents','existing_responses','denominators'] LOOP
        ev := s->'evidence'->k;
        IF jsonb_typeof(ev) IS DISTINCT FROM 'array' THEN ok := false;
        ELSE
            ok := ok AND jsonb_array_length(ev) > 0 AND NOT EXISTS (
                SELECT FROM jsonb_array_elements(ev) x
                WHERE jsonb_typeof(x) <> 'object' OR NOT x ? 'spec_id'
                   OR NOT (card_nonblank(x->'spec_id')
                           OR (jsonb_typeof(x->'spec_id') = 'null' AND card_nonblank(x->'note'))));
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
    -- 양식 B2: 계산할 지표 1–3개. rule은 주 지표 행에 있고 indicator_id 일치는 지표 트리거가 막는다.
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
    -- 연령은 지표 ID 끝(_19_39)이 원본. 판단 문장·population에 적힌 연령 숫자가 그와 같아야 한다.
    -- 연령 없는 지표(air_pm25)는 문장·population에도 연령이 없으면 통과.
    check_no := 7; label := '판단 문장·적용 대상 연령과 주 지표 ID 연령 일치';
    ok := main_id IS NOT NULL
        AND (regexp_match(claim, age_pattern) IS NULL
             OR regexp_match(claim, age_pattern) = regexp_match(main_id, '_(\d+)_(\d+)$'))
        AND (regexp_match(coalesce(s->'applicability'->>'population', ''), age_pattern) IS NULL
             OR regexp_match(s->'applicability'->>'population', age_pattern) = regexp_match(main_id, '_(\d+)_(\d+)$'));
    ok := coalesce(ok, false); RETURN NEXT;
    -- 양식 B5: observed_fact / calculated / associated 중 최대(insufficient_evidence는 실행 결과이지 상한이 아님).
    check_no := 8; label := '적용 조건·허용 판단 수준·선택 필드';
    ok := coalesce(s->'applicability'->>'place_level' IN ('sido','sigungu','emd','station'), false)
        AND coalesce((s->'applicability'->>'min_complete_years') ~ '^[1-9][0-9]*$', false)
        AND coalesce(s->>'max_claim_level' IN ('observed_fact','calculated','associated'), false)
        AND card_string_array(coalesce(s->'inclusion','[]')) AND card_string_array(coalesce(s->'exclusion','[]'))
        AND card_string_array(coalesce(s->'keywords','[]')) AND card_string_array(coalesce(s->'forbidden_terms','[]'))
        AND jsonb_typeof(coalesce(s->'expected_gaps','[]')) = 'array';
    RETURN NEXT;
    -- 양식 E1·E2. legend_text는 대표 승인 칸(#171 approval.approved_fields).
    check_no := 9; label := '지도 표현과 범례 문구';
    ok := card_nonblank(s->'map_mode') AND card_string_array(s->'legend_text', 1);
    RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION approve_card(p_card_id text, p_approved_by text, p_draft_revision bigint, p_reason text)
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
        -- #171 approval(대표 승인 칸 기록)은 초안 그대로 두고, 저장 승인 기록은 card_approval에 둔다.
        'card_approval',jsonb_build_object('approved_by',p_approved_by,'approved_at',now(),'reason',p_reason));
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
