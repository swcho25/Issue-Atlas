-- ⑤ 반박 근거 구절을 어떻게 골랐는지(S15P31C108-326, AI 계약 v0.5 결과 retrieval).
-- {method: rebuttal_r3 | card_tags, query_version, k, candidates, picked[{rebuttal, rank, source_id, score, cosine, lexical}]}.
-- engine 이 고르기 전에 멈췄거나(skipped · INPUT_INVALID) engine 에 못 닿았거나 옛 engine 이면 null. C2 응답(result)에는 넣지 않는다.
ALTER TABLE argument_phrasing
    ADD COLUMN retrieval jsonb CHECK (retrieval IS NULL OR jsonb_typeof(retrieval) = 'object');
