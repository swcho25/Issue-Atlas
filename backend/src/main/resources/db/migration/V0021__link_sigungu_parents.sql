-- 시군구의 상위 지역(contracts/p3 v0.5). V0011 시군구 6곳은 parent_id 가 비어 있어, 상위 지역 코드에 붙은 자료
--   (세출 「광주 본청」 · 보도자료 광주광역시 = KOSIS 29 → kr-29, V0018)를 구에서 찾아 올라갈 길이 없었다.
-- 광주 5개 구 → 광주광역시(5개 구) kr-29, 여수시 → 옛 전라남도(22개 시군) kr-46. kr-29 · kr-46 의 상위는 통합시 kr-12(V0018).
-- 지역 목록(GET /v1/places)의 시군구 parent_id 도 이 값으로 나간다(시도는 목록에 없다).
UPDATE place SET parent_id = 'kr-29'
WHERE place_id IN ('plc_gwangju_donggu', 'plc_gwangju_seogu', 'plc_gwangju_namgu', 'plc_gwangju_bukgu', 'plc_gwangju_gwangsangu');

UPDATE place SET parent_id = 'kr-46' WHERE place_id = 'plc_yeosu';
