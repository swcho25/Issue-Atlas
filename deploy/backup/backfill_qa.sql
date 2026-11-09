-- 150번: 2026-11-09에 확인한 QA 자료만 제외. 격리된 rehearsal DB에서만 실행한다.
-- 실제 개발/운영 DB에서는 실행하지 않는다. 새 참조가 생기면 FK 검사에서 전체 롤백한다.
BEGIN;
DO $$ BEGIN
    IF current_database() <> 'rehearsal' THEN
        RAISE EXCEPTION 'Only the isolated rehearsal database is allowed';
    END IF;
    IF (SELECT count(*) FROM card WHERE card_id IN ('C989','C990')
        AND name ~ 'QA(205|216)') <> 2 THEN
        RAISE EXCEPTION 'QA card identity changed; review exclusions again';
    END IF;
    IF (SELECT count(*) FROM app_user WHERE id IN (3,4,5)
        AND NOT is_active AND email ~* '(qa|test|smoke|example)') <> 3 THEN
        RAISE EXCEPTION 'QA user identity changed; review exclusions again';
    END IF;
    IF EXISTS (SELECT FROM question WHERE card_id IN ('C989','C990'))
       OR EXISTS (SELECT FROM indicator WHERE added_by_card IN ('C989','C990'))
       OR EXISTS (SELECT FROM existing_response WHERE card_id IN ('C989','C990')) THEN
        RAISE EXCEPTION 'QA cards now have additional data; review before deleting';
    END IF;
END $$;
CREATE TEMP TABLE qa_reviews ON COMMIT DROP AS
    SELECT review_id FROM review_request
    WHERE reason LIKE '[QA216]%'
       OR (review_id='review_87bf8f9a-6174-42a2-a897-4fce40848f74'
           AND reason LIKE '[화면 확인]%');
CREATE TEMP TABLE qa_csv ON COMMIT DROP AS
    SELECT r.import_id FROM csv_import_request r
    LEFT JOIN csv_import_result s USING(import_id)
    WHERE (r.import_id='import_b7613c65-35a3-470e-8df3-a30af17fee9f'
           AND r.file_name='ui-test-valid.csv'
           OR r.import_id='import_83fcb034-4a9d-4340-9b6e-6b7090b46269'
           AND r.file_name='ui-test-invalid.csv') AND coalesce(s.loaded_rows,0)=0;
-- 복원된 확인용 감사 이력도 제외하도록 이 트랜잭션에서만 트리거를 중지한다.
-- 외래키도 일시 중지되므로 아래에서 public의 모든 FK를 실제 데이터로 검사한다.
SET LOCAL session_replication_role = replica;
DELETE FROM review_change WHERE review_id IN (SELECT review_id FROM qa_reviews);
DELETE FROM review_request WHERE review_id IN (SELECT review_id FROM qa_reviews);
DELETE FROM csv_import_result WHERE import_id IN (SELECT import_id FROM qa_csv);
DELETE FROM csv_import_request WHERE import_id IN (SELECT import_id FROM qa_csv);
DELETE FROM card_approval_decision WHERE request_id IN
    (SELECT request_id FROM card_approval_request WHERE card_id IN ('C989','C990'));
DELETE FROM card_approval_request WHERE card_id IN ('C989','C990');
DELETE FROM document_card_score WHERE card_id IN ('C989','C990');
DELETE FROM card_search_profile WHERE card_id IN ('C989','C990');
DELETE FROM card_claim_item WHERE card_id IN ('C989','C990');
DELETE FROM card_evidence_bind WHERE card_id IN ('C989','C990');
DELETE FROM card_evidence_policy WHERE card_id IN ('C989','C990');
DELETE FROM card_rebuttal WHERE card_id IN ('C989','C990');
DELETE FROM card_revision WHERE card_id IN ('C989','C990');
DELETE FROM card_version WHERE card_id IN ('C989','C990');
DELETE FROM card_evidence_status WHERE card_id IN ('C989','C990');
DELETE FROM card WHERE card_id IN ('C989','C990');
DELETE FROM app_user WHERE id IN (3,4,5);
SET LOCAL session_replication_role = origin;
DO $$
DECLARE fk record; predicates text; nonnull text; orphan boolean;
BEGIN
    FOR fk IN SELECT c.* FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
        WHERE c.contype='f' AND n.nspname='public' LOOP
        SELECT string_agg(format('c.%I=p.%I',ca.attname,pa.attname),' AND '),
               string_agg(format('c.%I IS NOT NULL',ca.attname),' AND ')
          INTO predicates,nonnull
          FROM unnest(fk.conkey,fk.confkey) AS k(child_col,parent_col)
          JOIN pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=k.child_col
          JOIN pg_attribute pa ON pa.attrelid=fk.confrelid AND pa.attnum=k.parent_col;
        EXECUTE format('SELECT EXISTS (SELECT FROM %s c WHERE %s AND NOT EXISTS '
            '(SELECT FROM %s p WHERE %s))',fk.conrelid::regclass,nonnull,
            fk.confrelid::regclass,predicates) INTO orphan;
        IF orphan THEN RAISE EXCEPTION 'Orphan detected: %',fk.conname; END IF;
    END LOOP;
END $$;
COMMIT;
