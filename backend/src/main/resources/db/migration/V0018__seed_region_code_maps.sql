-- 지역 코드 연결 보완(contracts/p3 v0.2). 2026-11-01 개발 DB 에서 place_code_map 에 없어 지역으로 잇지 못하던 코드를 잇는다.
--   온통청년 청년정책 bjd 12130 · 12210 …(5,633행), 세출 「광주 본청」 · 보도자료 광주광역시의 KOSIS 29(광주 전체, 15,399행),
--   측정소 메타의 airkorea_station_name(22행), KOSIS 이동(SP02) 도착 시도 locator.C2(17곳)
-- 새 place 는 시도 단위 18곳: KOSIS 시도 2자리 17곳(광주 29 · 전남 46 따로) + 통합시 12.
-- place_id 는 kr-<코드>: 11/3 place_id kr- 전환과 같은 형식이고, news_event.place_id 가 이미 kr-29 · kr-12 · kr-44 … 로 가리킨다.
-- 기존 시군구 · 측정소 행(V0011 · V0017)은 고치지 않고, 그 행에 잇는 코드는 place_id 대신 기존 코드로 찾는다(형식이 바뀌어도 맞게).

-- 좌표는 P3 시도 대표점: SGIS 시도 중심. 인천은 섬(강화 · 옹진) 때문에 중심이 강화도에 찍혀 시청 위치,
-- 광주 29 · 전남 46 은 통합 뒤 SGIS 가 통합시 중심만 줘서 5개 구 · 22개 시군 중심의 평균. 모두 admin_centroid.
-- attrs {sido, sigun, gu} 는 news_event 지역 칸과 같은 값이다(광주 29 = 통합시 · 광주, 통합시 12 = 통합시만).
-- 옛 전남 46 에 해당하는 기사 지역 값은 없어 attrs 를 비운다.
INSERT INTO place (place_id, name, level, geometry, location_precision, attrs)
SELECT v.place_id, v.name, 'sido', ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, 'admin_centroid', v.region
FROM (VALUES
    ('kr-12', '전남광주통합특별시', 127.0015026, 34.8914813, '{"sido": "전남광주통합특별시", "sigun": null, "gu": null}'::jsonb),
    ('kr-29', '광주광역시(5개 구)', 126.8688502, 35.1419243, '{"sido": "전남광주통합특별시", "sigun": "광주", "gu": null}'),
    ('kr-46', '전라남도(22개 시군)', 126.8905923, 34.8923803, '{}'),
    ('kr-11', '서울특별시', 126.9396081, 37.5644811, '{"sido": "서울", "sigun": null, "gu": null}'),
    ('kr-26', '부산광역시', 129.0539550, 35.2111695, '{"sido": "부산", "sigun": null, "gu": null}'),
    ('kr-27', '대구광역시', 128.6496004, 35.9649200, '{"sido": "대구", "sigun": null, "gu": null}'),
    ('kr-28', '인천광역시', 126.7052557, 37.4560499, '{"sido": "인천", "sigun": null, "gu": null}'),
    ('kr-30', '대전광역시', 127.3874750, 36.3416758, '{"sido": "대전", "sigun": null, "gu": null}'),
    ('kr-31', '울산광역시', 129.2147662, 35.5267192, '{"sido": "울산", "sigun": null, "gu": null}'),
    ('kr-36', '세종특별자치시', 127.2697257, 36.5702933, '{"sido": "세종", "sigun": null, "gu": null}'),
    ('kr-41', '경기도', 127.4083580, 37.5884751, '{"sido": "경기", "sigun": null, "gu": null}'),
    ('kr-51', '강원특별자치도', 128.2089912, 37.8236727, '{"sido": "강원", "sigun": null, "gu": null}'),
    ('kr-43', '충청북도', 127.5720191, 36.6359042, '{"sido": "충북", "sigun": null, "gu": null}'),
    ('kr-44', '충청남도', 126.8699606, 36.5220663, '{"sido": "충남", "sigun": null, "gu": null}'),
    ('kr-52', '전북특별자치도', 127.1228070, 35.7282685, '{"sido": "전북", "sigun": null, "gu": null}'),
    ('kr-47', '경상북도', 128.6367852, 36.3620705, '{"sido": "경북", "sigun": null, "gu": null}'),
    ('kr-48', '경상남도', 128.3742292, 35.3683857, '{"sido": "경남", "sigun": null, "gu": null}'),
    ('kr-50', '제주특별자치도', 126.5474422, 33.3805172, '{"sido": "제주", "sigun": null, "gu": null}')
) AS v (place_id, name, lon, lat, region);

-- 광주 29 · 옛 전남 46 은 지금의 통합시 안이다
UPDATE place SET parent_id = 'kr-12' WHERE place_id IN ('kr-29', 'kr-46');

-- KOSIS 시도 2자리 → 시도 place. SP02 도착 시도(locator.C2), 세출 · 보도자료의 광주 전체 29 가 이 코드다.
-- 29 · 46 은 통합 뒤 KOSIS 가 쓰지 않지만 다른 곳을 가리킬 일이 없고 수집기가 그 뒤에도 29 를 쓰므로 유효 기간을 두지 않는다.
-- 통합시 12 는 2026-07-01 부터의 KOSIS 시도 코드
INSERT INTO place_code_map (place_id, code_system, place_code, valid_from, valid_to) VALUES
    ('kr-11', 'kosis', '11', NULL, NULL),
    ('kr-26', 'kosis', '26', NULL, NULL),
    ('kr-27', 'kosis', '27', NULL, NULL),
    ('kr-28', 'kosis', '28', NULL, NULL),
    ('kr-29', 'kosis', '29', NULL, NULL),
    ('kr-30', 'kosis', '30', NULL, NULL),
    ('kr-31', 'kosis', '31', NULL, NULL),
    ('kr-36', 'kosis', '36', NULL, NULL),
    ('kr-41', 'kosis', '41', NULL, NULL),
    ('kr-51', 'kosis', '51', NULL, NULL),
    ('kr-43', 'kosis', '43', NULL, NULL),
    ('kr-44', 'kosis', '44', NULL, NULL),
    ('kr-52', 'kosis', '52', NULL, NULL),
    ('kr-46', 'kosis', '46', NULL, NULL),
    ('kr-47', 'kosis', '47', NULL, NULL),
    ('kr-48', 'kosis', '48', NULL, NULL),
    ('kr-50', 'kosis', '50', NULL, NULL),
    ('kr-12', 'kosis', '12', DATE '2026-07-01', NULL);

-- 온통청년 zipCd(법정 시군구 5자리, 통합 뒤 새 코드) → 시군구 6곳. KOSIS 새 코드와 같은 값이라 그 행의 place 로 잇는다
INSERT INTO place_code_map (place_id, code_system, place_code, valid_from, valid_to)
SELECT m.place_id, 'bjd', m.place_code, NULL, NULL
FROM place_code_map m
WHERE m.code_system = 'kosis' AND m.place_code IN ('12130', '12210', '12240', '12270', '12300', '12330');

-- 측정소 메타(airkorea_stations)의 측정소 이름 → 측정소. 이름은 괄호 구분자까지 그대로(「우산동(광주)」)
INSERT INTO place_code_map (place_id, code_system, place_code, valid_from, valid_to)
SELECT p.place_id, 'airkorea_station_name', p.name, NULL, NULL
FROM place p
WHERE p.level = 'station';
