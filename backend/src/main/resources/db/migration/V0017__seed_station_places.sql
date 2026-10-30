-- 측정소 · 시군구 위치(contracts/p3 「지역」). 입력은 P3 지역표 stat_region(SGIS 시군구 중심 · 에어코리아 측정소 좌표).
-- 측정소 place_id 는 C2 예시(contracts/c2/examples/observations-a3-yeosu.json)와 같은 plc_stn_<측정소 코드>, 부모는 V0011 의 시군구.
-- GET /v1/observations 가 이 행을 읽는다. 측정소 유형(도시대기 · 항만 …)은 P3 자료에 없어 넣지 않는다.

-- 시군구 6곳: 행정 중심 좌표, 기사 지역 칸(news_event sido · sigun · gu)과 맞출 세 값
UPDATE place p
SET geometry = ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
    location_precision = 'admin_centroid',
    attrs = p.attrs || v.region
FROM (VALUES
    ('plc_yeosu', 127.6710019, 34.7622503, '{"sido": "전남광주통합특별시", "sigun": "여수시", "gu": null}'::jsonb),
    ('plc_gwangju_donggu', 126.9614554, 35.1190538, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": "동구"}'),
    ('plc_gwangju_seogu', 126.8538884, 35.1348966, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": "서구"}'),
    ('plc_gwangju_namgu', 126.8799026, 35.1017973, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": "남구"}'),
    ('plc_gwangju_bukgu', 126.9097147, 35.1895670, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": "북구"}'),
    ('plc_gwangju_gwangsangu', 126.7392898, 35.1643067, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": "광산구"}')
) AS v (place_id, lon, lat, region)
WHERE p.place_id = v.place_id;

-- 측정소 22곳(여수 9 · 광주 13). 이름은 에어코리아 측정소명, 주소는 도로명주소
INSERT INTO place (place_id, name, level, parent_id, geometry, location_precision, geometry_role, attrs)
SELECT v.place_id, v.name, 'station', v.parent_id,
       ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, 'exact', 'station',
       jsonb_build_object('address', v.address)
FROM (VALUES
    ('plc_stn_336121', '서강동', 'plc_yeosu', 127.7259670, 34.7413010, '전남광주통합특별시 여수시 서교1길 28-1 서강동주민자치센터 (서교동)'),
    ('plc_stn_336124', '월내동', 'plc_yeosu', 127.7319330, 34.8500830, '전남광주통합특별시 여수시 여수산단로 1201 (월내동)'),
    ('plc_stn_336125', '문수동', 'plc_yeosu', 127.7027600, 34.7545490, '전남광주통합특별시 여수시 여문1로 71 (문수동)'),
    ('plc_stn_336127', '여천동(여수)', 'plc_yeosu', 127.6575070, 34.7663010, '전남광주통합특별시 여수시 무선로 190 (선원동)'),
    ('plc_stn_336128', '덕충동', 'plc_yeosu', 127.7468000, 34.7539000, '전남광주통합특별시 여수시 덕충안길 95 (덕충동)'),
    ('plc_stn_336221', '화양면', 'plc_yeosu', 127.5974120, 34.6856780, '전남광주통합특별시 여수시 화양면 평촌길 2-6'),
    ('plc_stn_336222', '율촌면', 'plc_yeosu', 127.5787830, 34.8819250, '전남광주통합특별시 여수시 율촌면 동산개길 2'),
    ('plc_stn_336223', '삼일동', 'plc_yeosu', 127.7316150, 34.8247640, '전남광주통합특별시 여수시 상암로 601-1 (상암동)'),
    ('plc_stn_336903', '여수항', 'plc_yeosu', 127.7326120, 34.7384860, '전남광주통합특별시 여수시 여객선터미널길 17 (교동)'),
    ('plc_stn_324115', '서석동', 'plc_gwangju_donggu', 126.9233300, 35.1458300, '전남광주통합특별시 동구 서남로 1 (서석동)'),
    ('plc_stn_324121', '농성동', 'plc_gwangju_seogu', 126.8896990, 35.1566510, '전남광주통합특별시 서구 상무대로 1165 (농성동)'),
    ('plc_stn_324123', '치평동', 'plc_gwangju_seogu', 126.8532920, 35.1516250, '전남광주통합특별시 서구 상무자유로 170 (치평동)'),
    ('plc_stn_324125', '유촌동', 'plc_gwangju_seogu', 126.8441670, 35.1619440, '전남광주통합특별시 서구 천변우하로 203'),
    ('plc_stn_324124', '노대동', 'plc_gwangju_namgu', 126.8965634, 35.1000281, '전남광주통합특별시 남구 덕남길 7 (노대동)'),
    ('plc_stn_324155', '주월동', 'plc_gwangju_namgu', 126.8933000, 35.1319170, '전남광주통합특별시 남구 회서로 21번가길 13'),
    ('plc_stn_324133', '두암동', 'plc_gwangju_bukgu', 126.9325000, 35.1743000, '전남광주통합특별시 북구 군왕로 141번길 6 (두암보건지소)'),
    ('plc_stn_324134', '운암동', 'plc_gwangju_bukgu', 126.8569310, 35.1761060, '전남광주통합특별시 북구 북문대로 79 (운암동)'),
    ('plc_stn_324135', '건국동', 'plc_gwangju_bukgu', 126.8618600, 35.2293300, '전남광주통합특별시 북구 첨단과기로 333 (대촌동)'),
    ('plc_stn_324136', '일곡동', 'plc_gwangju_bukgu', 126.8925000, 35.2180560, '전남광주통합특별시 북구 모룡대길 68 (일곡동)'),
    ('plc_stn_324142', '오선동', 'plc_gwangju_gwangsangu', 126.8072000, 35.2041300, '전남광주통합특별시 광산구 하남산단 6번로 107'),
    ('plc_stn_324143', '우산동(광주)', 'plc_gwangju_gwangsangu', 126.8100970, 35.1577420, '전남광주통합특별시 광산구 우산동 1026-2'),
    ('plc_stn_324148', '평동', 'plc_gwangju_gwangsangu', 126.7686700, 35.1232200, '전남광주통합특별시 광산구 평동산단로 184-1 (월전동)')
) AS v (place_id, name, parent_id, lon, lat, address);

-- 측정소 코드(air_monthly.station_code)는 place_id 의 plc_stn_ 뒤. 코드 변경 이력을 아직 몰라 유효 기간은 비워 둔다
INSERT INTO place_code_map (place_id, code_system, place_code)
SELECT place_id, 'airkorea_station', substring(place_id FROM length('plc_stn_') + 1)
FROM place
WHERE level = 'station' AND starts_with(place_id, 'plc_stn_');
