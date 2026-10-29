-- 질문 화면에서 고르는 지역 6곳(광주 5구 · 여수시)과 KOSIS 행정구역 코드.
-- 2026-07-01 행정통합으로 코드가 바뀌었다. 옛 코드는 2026-06-30 까지, 새 코드는 2026-07-01 부터(양 끝 포함).
-- place_id 는 C2 예시(contracts/c2/examples/place-list.json)와 같다.
INSERT INTO place (place_id, name, level) VALUES
    ('plc_gwangju_donggu', '광주 동구', 'sigungu'),
    ('plc_gwangju_seogu', '광주 서구', 'sigungu'),
    ('plc_gwangju_namgu', '광주 남구', 'sigungu'),
    ('plc_gwangju_bukgu', '광주 북구', 'sigungu'),
    ('plc_gwangju_gwangsangu', '광주 광산구', 'sigungu'),
    ('plc_yeosu', '여수시', 'sigungu');

INSERT INTO place_code_map (place_id, code_system, place_code, valid_from, valid_to) VALUES
    ('plc_gwangju_donggu', 'kosis', '29110', NULL, DATE '2026-06-30'),
    ('plc_gwangju_donggu', 'kosis', '12210', DATE '2026-07-01', NULL),
    ('plc_gwangju_seogu', 'kosis', '29140', NULL, DATE '2026-06-30'),
    ('plc_gwangju_seogu', 'kosis', '12240', DATE '2026-07-01', NULL),
    ('plc_gwangju_namgu', 'kosis', '29155', NULL, DATE '2026-06-30'),
    ('plc_gwangju_namgu', 'kosis', '12270', DATE '2026-07-01', NULL),
    ('plc_gwangju_bukgu', 'kosis', '29170', NULL, DATE '2026-06-30'),
    ('plc_gwangju_bukgu', 'kosis', '12300', DATE '2026-07-01', NULL),
    ('plc_gwangju_gwangsangu', 'kosis', '29200', NULL, DATE '2026-06-30'),
    ('plc_gwangju_gwangsangu', 'kosis', '12330', DATE '2026-07-01', NULL),
    ('plc_yeosu', 'kosis', '46130', NULL, DATE '2026-06-30'),
    ('plc_yeosu', 'kosis', '12130', DATE '2026-07-01', NULL);
