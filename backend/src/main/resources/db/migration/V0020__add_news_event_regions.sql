-- 기사 지역 여러 곳(contracts/p3 v0.4, 2026-11-01 결정). 여러 지역을 다룬 기사는 그 지역을 모두 배열로 둔다.
-- 원소 = {sido, sigun, gu}. 값은 기존 sido · sigun · gu 칸과 같은 말을 쓰고, 정해지지 않은 단계는 JSON null.
--   시도: 전남광주통합특별시 · 전국 · 다른 시도 약칭(충남 · 서울 …)
--   시군: 여수시 · 영광군 …, 광주 5개 구는 「광주」로 묶는다. 구: 동구 · 서구 · 남구 · 북구 · 광산구
-- 첫 원소가 대표 지역이고 sido · sigun · gu 칸과 늘 같다(그 칸은 호환을 위해 그대로 둔다).
-- 전국이라 밝힌 기사 · 특정 지역이 없는 기사는 [{"sido": "전국", "sigun": null, "gu": null}].
-- 빈 배열은 보류(지역 미정)만. 지금 적재기는 보류 행을 쓰지 않지만 막지는 않는다.
ALTER TABLE news_event
    ADD COLUMN regions jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT ck_news_event_regions_array CHECK (jsonb_typeof(regions) = 'array');

-- 기존 행(개발 DB 3,477건)은 지역 칸 하나를 원소 하나로 옮긴다
UPDATE news_event
SET regions = jsonb_build_array(jsonb_build_object('sido', sido, 'sigun', sigun, 'gu', gu));

-- 원소 포함 조회(regions @> '[{"sigun": "여수시"}]')용. 지역 맞추기(contracts/p3)는 원소 하나라도 맞으면 고른다
CREATE INDEX idx_news_event_regions ON news_event USING GIN (regions jsonb_path_ops);
