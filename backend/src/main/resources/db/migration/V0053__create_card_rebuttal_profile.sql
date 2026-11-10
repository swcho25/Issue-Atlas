-- ⑤ 반박 검색 질의 벡터(S15P31C108-326). 승인 카드 판의 rebuttals.items 마다
-- 「{카드 이름}의 다른 설명: {반박 문장}」(query_version rebuttal-query-v1)을 기사와 같은 모델 · 차원으로 임베딩한다.
-- 질문 때 그 지역 · 기간 기사와 코사인을 구해 반박별 근거 후보를 고르는 데 쓴다(다음 MR). card_search_profile 과 같은 모양이다.
CREATE TABLE card_rebuttal_profile (
    card_id text NOT NULL,
    card_version integer NOT NULL,
    rebuttal_id text NOT NULL CHECK (btrim(rebuttal_id) <> ''),
    query_version text NOT NULL,
    query_text text NOT NULL CHECK (btrim(query_text) <> ''),
    query_hash text NOT NULL CHECK (query_hash ~ '^[0-9a-f]{64}$'),
    model text NOT NULL,
    embedding vector(1536) NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    embedded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, card_version, rebuttal_id, query_version),
    FOREIGN KEY (card_id, card_version) REFERENCES card_version (card_id, version)
);
-- 카드의 반박 하나마다 활성 질의 하나
CREATE UNIQUE INDEX uq_card_rebuttal_profile_active
    ON card_rebuttal_profile (card_id, rebuttal_id) WHERE is_active;
