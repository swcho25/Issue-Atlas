-- 시군구 6곳 place_id 를 plc_* 에서 kr-<KOSIS 새 시군구 5자리> 로 바꾼다(11/3 kr- 전환, contracts/p3 v0.6).
-- 행정동(V0019 kr-<시군구 5자리><읍면동 3자리>) · 시도(V0018 kr-<2자리>)와 같은 형식이다. 측정소 plc_stn_* 은 형식을 정한 뒤 따로 바꾼다.
-- FK 에 ON UPDATE CASCADE 가 없어, 새 ID 로 행을 복사 → 참조를 옮김 → 옛 행을 지운다.
CREATE TEMP TABLE sigungu_id (old_id text PRIMARY KEY, new_id text NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO sigungu_id VALUES
    ('plc_gwangju_donggu', 'kr-12210'),
    ('plc_gwangju_seogu', 'kr-12240'),
    ('plc_gwangju_namgu', 'kr-12270'),
    ('plc_gwangju_bukgu', 'kr-12300'),
    ('plc_gwangju_gwangsangu', 'kr-12330'),
    ('plc_yeosu', 'kr-12130');

-- 칸을 하나하나 적지 않고 행 전체를 복사해 place_id 만 바꾼다
INSERT INTO place
SELECT (jsonb_populate_record(p, jsonb_build_object('place_id', m.new_id))).*
FROM place p JOIN sigungu_id m ON m.old_id = p.place_id;

UPDATE place t SET parent_id = m.new_id FROM sigungu_id m WHERE t.parent_id = m.old_id;
UPDATE place_code_map t SET place_id = m.new_id FROM sigungu_id m WHERE t.place_id = m.old_id;
UPDATE card_evidence_status t SET place_id = m.new_id FROM sigungu_id m WHERE t.place_id = m.old_id;
UPDATE existing_response t SET place_id = m.new_id FROM sigungu_id m WHERE t.place_id = m.old_id;
UPDATE question t SET place_id = m.new_id FROM sigungu_id m WHERE t.place_id = m.old_id;
-- 저장된 실행 결과(C2 argument)의 지역 ID 도 같은 이름으로 바꾼다. 판단 내용은 고치지 않는다
UPDATE argument_run t
SET result = jsonb_set(t.result, '{question,place_id}', to_jsonb(m.new_id))
FROM sigungu_id m WHERE t.result #>> '{question,place_id}' = m.old_id;

DELETE FROM place p USING sigungu_id m WHERE p.place_id = m.old_id;
