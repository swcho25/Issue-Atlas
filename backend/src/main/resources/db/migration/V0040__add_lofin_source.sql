-- 세출 출처 행(S15P31C108-234). 개발 DB 의 local_expenditure 는 실행 기록을 남기기 전 수집기(lofin-0.1.0)로 들어가
-- source 에 lofin 행이 없다. 그래서 기존 대응 후보(existing_response.origin = 'lofin')가 출처 등급을 못 찾아 근거가 되지 않았다.
-- 세출 수집기(engine pipeline/collect/lofin.py LofinQuery)와 같은 값으로 넣는다. 이용 조건 · 저장 범위가 다르면
-- 수집기가 SOURCE_CONTRACT_MISMATCH 로 멈춘다. 등급은 V0039 트리거가 B 로 채운다. 이미 있으면 그대로 둔다.
INSERT INTO source (source_id, name, org, license_type, storage_scope)
VALUES ('lofin', '지방재정365 세부사업별 세출현황', '행정안전부', '공공데이터-이용허락범위제한없음', 'full')
ON CONFLICT (source_id) DO NOTHING;
