-- 측정소 22곳 place_id 를 plc_stn_<에어코리아 코드> 에서 kr-<부모 시군구 5자리>-s<에어코리아 코드> 로 바꾼다
-- (contracts/p3 v0.8 「측정소 ID」, 11/4 동결 전 · 장성우 동의 2026-11-03). 예: plc_stn_336121 → kr-12130-s336121.
-- 시군구 앞자리로 고르면 그 안 측정소가 함께 잡히고, -s 가 있어 숫자만인 지역 ID 와 겹치지 않는다.
-- V0024 와 같은 방법: FK 에 ON UPDATE CASCADE 가 없어, 새 ID 로 행을 복사 → 참조를 옮김 → 옛 행을 지운다.
-- V0017 은 고치지 않는다. place_code_map 은 place_id 만 옮기고 에어코리아 코드 값은 그대로다.
CREATE TEMP TABLE station_id (old_id text PRIMARY KEY, new_id text NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO station_id
SELECT p.place_id, p.parent_id || '-s' || c.place_code
FROM place p
JOIN place_code_map c ON c.place_id = p.place_id AND c.code_system = 'airkorea_station'
WHERE p.level = 'station' AND starts_with(p.place_id, 'plc_stn_') AND p.parent_id ~ '^kr-[0-9]{5}$';

-- 칸을 하나하나 적지 않고 행 전체를 복사해 place_id 만 바꾼다
INSERT INTO place
SELECT (jsonb_populate_record(p, jsonb_build_object('place_id', m.new_id))).*
FROM place p JOIN station_id m ON m.old_id = p.place_id;

UPDATE place t SET parent_id = m.new_id FROM station_id m WHERE t.parent_id = m.old_id;
UPDATE place_code_map t SET place_id = m.new_id FROM station_id m WHERE t.place_id = m.old_id;
UPDATE card_evidence_status t SET place_id = m.new_id FROM station_id m WHERE t.place_id = m.old_id;
UPDATE existing_response t SET place_id = m.new_id FROM station_id m WHERE t.place_id = m.old_id;
UPDATE question t SET place_id = m.new_id FROM station_id m WHERE t.place_id = m.old_id;
-- 저장된 실행 결과(C2 argument)의 측정소 ID(series[].station_id 등)도 바꾼다. 따옴표째 바꿔 다른 값 속 글자는 건드리지 않는다.
-- 판단 내용은 고치지 않는다
UPDATE argument_run t
SET result = replace(t.result::text, '"' || m.old_id || '"', '"' || m.new_id || '"')::jsonb
FROM station_id m WHERE t.result::text LIKE '%"' || m.old_id || '"%';

DELETE FROM place p USING station_id m WHERE p.place_id = m.old_id;

-- 옛 형식이 남으면(부모 시군구가 kr- 가 아니거나 코드 연결이 없는 측정소) 멈춘다
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM place WHERE starts_with(place_id, 'plc_stn_')) THEN
        RAISE EXCEPTION 'plc_stn_ 측정소가 남았다 — 부모 시군구 · airkorea_station 코드 연결을 확인';
    END IF;
END $$;
