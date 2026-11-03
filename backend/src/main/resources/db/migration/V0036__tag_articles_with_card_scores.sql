-- 관측 view 의 기사 카드 태그(tags)를 기사→카드 1차 분류(V0035 document_card_score)로 채운다(S15P31C108-215).
-- V0031 은 병합 · 적용됐으므로 고치지 않고 같은 칸 · 같은 순서로 다시 정의한다. 바뀐 것은 기사 행의 tags 만이다.
--   기사 tags = 지금 활성인 기사 벡터 × 활성 카드 프로필로 계산해 기준을 넘은(selected) 카드. 없으면 빈 배열
-- 칸 · 매핑 설명은 V0025 · V0031 과 contracts/observation 을 본다.
CREATE OR REPLACE VIEW observation AS
WITH indicator_code (spec_id, code, what_id, tags) AS (
    VALUES
        -- SP01 순이동: locator.C3 연령
        ('SP01', '000', 'population_net_migration_total', ARRAY['C1']),
        ('SP01', '901', 'population_net_migration_19_34', ARRAY['C1']),
        ('SP01', '905', 'population_net_migration_19_39', ARRAY['C1']),
        -- SP10 주민등록인구: locator.C2 연령. 1세별 코드는 묶음 번호(12 · 13 · 15 · 16) + 묶음 안 순서 1–5
        -- (KOSIS DT_1B04006 C2_NM 으로 확인, 박준우 2026-11-02): 1201 = 20세 … 1605 = 39세
        -- 전체 인구는 지표 사전에서 C1 · A3 의 분모, 19–39세 각 나이는 C1 청년 인구(비율 · 분모)의 재료
        ('SP10', '000', 'population_registered_total', ARRAY['C1', 'A3']),
        ('SP10', '1005', 'population_registered_19', ARRAY['C1'])
    UNION ALL
    SELECT 'SP10', g.prefix || '0' || i, 'population_registered_' || (g.first_age + i - 1), ARRAY['C1']
    FROM (VALUES ('12', 20), ('13', 25), ('15', 30), ('16', 35)) AS g (prefix, first_age),
         generate_series(1, 5) AS i
),
stat AS (
    SELECT n.*,
           CASE n.spec_id
               WHEN 'SP01' THEN n.record -> 'locator' ->> 'C3'
               WHEN 'SP10' THEN n.record -> 'locator' ->> 'C2'
           END AS age_code
    FROM normalized_ready n
    WHERE n.spec_id IN ('SP01', 'SP02', 'SP10') AND n.obs_key IS NOT NULL
)
SELECT
    s.obs_key AS obs_id,
    'indicator' AS what_type,
    coalesce(k.what_id, s.indicator_id) AS what_id,
    NULL::text AS what_kind,
    -- SP02 이동은 연령 코드가 없어 대응표를 거치지 않는다. 지표 사전에서 C1 의 관련 지표(claim_items related)
    CASE WHEN s.spec_id = 'SP02' THEN ARRAY['C1'] ELSE coalesce(k.tags, '{}'::text[]) END AS tags,
    s.observed_period_start AS when_start,
    s.observed_period_end AS when_end,
    s.observed_period_type AS when_unit,
    NULL::text AS when_precision,
    m.place_id,
    -- SP02 이동: 도착 시도(locator.C2) = 시도 place kr-<2자리>(V0018)
    CASE WHEN s.spec_id = 'SP02' THEN 'kr-' || (s.record -> 'locator' ->> 'C2') END AS to_place_id,
    NULL::text AS station_id,
    NULL::double precision AS lon,
    NULL::double precision AS lat,
    'none' AS location_precision,
    s.value,
    s.unit,
    coalesce(s.missing_reason, 'available') AS status,
    'normalized_record' AS source_table,
    s.spec_id,
    NULL::text AS summary
FROM stat s
JOIN place_code_map m ON m.code_system = s.place_code_system AND m.place_code = s.place_code_raw
LEFT JOIN indicator_code k ON k.spec_id = s.spec_id AND k.code = s.age_code
-- SP01 · SP10 은 대응표에 있는 연령 코드만, SP02 는 전국 합계(C2 = 00)를 뺀다
WHERE CASE s.spec_id
          WHEN 'SP02' THEN s.record -> 'locator' ->> 'C2' <> '00'
          ELSE k.what_id IS NOT NULL
      END

UNION ALL

-- 에어코리아 측정소 × 지표 × 월. 지역은 측정소의 시군구(측정소가 있는 읍면동은 아직 잇지 않았다)
SELECT
    'obs:' || encode(sha256(convert_to(
        'air_monthly|' || a.station_code || '|' || a.indicator_id || '|'
            || to_char(a.month_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'), 'UTF8')), 'hex'),
    'indicator',
    a.indicator_id,
    NULL,
    ARRAY['A3'],
    a.month_start,
    a.month_end,
    'M',
    NULL,
    st.parent_id,
    NULL,
    st.place_id,
    ST_X(st.geometry::geometry),
    ST_Y(st.geometry::geometry),
    st.location_precision,
    a.value_mean,
    a.unit,
    CASE WHEN a.value_mean IS NULL THEN 'not_published' ELSE 'available' END,
    'air_monthly',
    NULL,
    NULL
FROM air_monthly a
JOIN place_code_map c ON c.code_system = 'airkorea_station' AND c.place_code = a.station_code
JOIN place st ON st.place_id = c.place_id

UNION ALL

-- 기사 한 건. 근거가 되는 카드(tags)는 기사 분류(P4)의 모델 제안 결과다(사람 확정 연결 아님, contracts/article-card-search).
-- 요약이 바뀌어 새 입력이 활성이 됐거나 카드 프로필이 바뀌었는데 score 를 다시 돌리지 않았으면, 옛 점수는 쓰지 않는다
SELECT
    'obs:' || encode(sha256(convert_to('news_event|' || e.news_id, 'UTF8')), 'hex'),
    'document',
    e.news_id,
    'news',
    coalesce((
        SELECT array_agg(s.card_id ORDER BY s.card_id)
        FROM document_card_score s
        JOIN document_embedding_v1 d
            ON d.input_id = s.input_id AND d.doc_id = s.doc_id AND d.model = s.model AND d.is_active
        JOIN card_search_profile p
            ON p.card_id = s.card_id AND p.card_version = s.card_version
           AND p.profile_version = s.profile_version AND p.model = s.model AND p.is_active
        WHERE s.doc_id = 'news:' || e.news_id AND s.selected
    ), '{}'::text[]),
    e.event_start,
    e.event_end,
    NULL,
    e.time_precision,
    e.place_id,
    NULL,
    NULL,
    ST_X(e.geometry::geometry),
    ST_Y(e.geometry::geometry),
    e.location_precision,
    NULL,
    NULL,
    'available',
    'news_event',
    NULL,
    e.summary
FROM news_event e;
