-- 기사 전재 묶음(S15P31C108-267, P2 계약 「전재 묶음」). 같은 소식을 여러 언론사가 실은 기사를 한 묶음으로 잇는다.
-- 정제된 최신 기사(normalized_ready, kind = news) 하나에 한 행 — 혼자인 기사도 자기 묶음 하나다.
-- engine pipeline.refine.syndication 이 전체를 다시 계산해 바꿔 쓴다(지난 결과를 고치지 않고 통째로 갈아 끼운다).
-- 기사 표 · 정제 표와 FK 없이 둔다: 기사는 news_id 로 찾고, 정제를 다시 돌려도 이 표는 다음 묶기 전까지 그대로다.
CREATE TABLE news_syndication (
    news_id text PRIMARY KEY CHECK (btrim(news_id) <> ''),
    -- 묶음 번호 = 묶음에서 가장 먼저 발행된 기사의 news_id(발행 시각이 같으면 news_id 가 작은 것)
    group_id text NOT NULL CHECK (btrim(group_id) <> ''),
    -- 묶음 기사 수(1 = 혼자)
    group_size integer NOT NULL CHECK (group_size >= 1),
    -- 묶은 규칙 판(syn-0.1 = 제목 글자 2개 묶음 Jaccard 0.7 이상 · 발행일 3일 안)
    rule_version text NOT NULL CHECK (rule_version LIKE 'syn-%'),
    grouped_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_news_syndication_group ON news_syndication (group_id);
