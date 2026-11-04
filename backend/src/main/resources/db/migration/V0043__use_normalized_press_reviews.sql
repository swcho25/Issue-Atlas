-- S15P31C108-237. 옛 표를 지우기 전에 검수 대상만 정제 행으로 이전한다.
-- 제출 당시 값·제안·상태·처리 이력은 고치지 않는다. press_release 표 자체는 참조하지 않는다.
LOCK TABLE review_request IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE review_press_targets_237 ON COMMIT DROP AS
SELECT r.review_id,n.id AS normalized_id
FROM review_request r
LEFT JOIN LATERAL (
    SELECT n.id
    FROM normalized_record n
    LEFT JOIN raw_record w ON w.content_hash=n.content_hash
    WHERE n.record->'document'->>'kind'='press_release'
      AND n.record->'locator'->>'press_id'=r.target_id
      AND n.source_id=CASE split_part(r.target_id,':',1)
          WHEN 'yeosu' THEN 'press_yeosu' WHEN 'gwangju' THEN 'press_gwangju' END
    -- 요청 당시 목록과 같은 판이 있으면 우선한다. 없으면 최신 정제 판으로 연결한다.
    ORDER BY (w.payload @> jsonb_build_object(
        'press_id',r.target_id,'title',r.submitted_value->'title',
        'category',r.submitted_value->'category','department',r.submitted_value->'department',
        'published_on',r.submitted_value->'published_on','url',r.submitted_value->'url')) DESC NULLS LAST,
        (n.validation_status IN ('pass','fixed')) DESC,
        n.is_latest DESC NULLS LAST,n.refined_at DESC,n.id DESC
    LIMIT 1
) n ON true
WHERE r.target_type='press_release';

DO $$
BEGIN
    IF EXISTS(SELECT FROM review_press_targets_237 WHERE normalized_id IS NULL) THEN
        RAISE EXCEPTION 'Legacy press review has no normalized press record; complete data handoff first'
            USING ERRCODE='23514';
    END IF;
END $$;

UPDATE review_request r
SET target_type='normalized_record',target_id=m.normalized_id::text,
    revision=r.revision+1,updated_at=now()
FROM review_press_targets_237 m WHERE r.review_id=m.review_id;

ALTER TABLE review_request DROP CONSTRAINT review_request_target_type_check;
ALTER TABLE review_request ADD CONSTRAINT review_request_target_type_check
    CHECK(target_type IN ('news_event','normalized_record','source','card'));
