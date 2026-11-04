-- 논증 문장화 기록(S15P31C108-231). 실행 한 건에 한 행: 응답(argument_run.result)의 ③ 보증 · ⑤ 반박이
-- AI 문장인지 카드 문구인지, 카드 문구로 돌아갔다면 왜인지(사유 코드 · 떨어진 검사), 인용 구절과 원문 위치.
-- 응답 칸은 그대로(C2 동결). 사유 코드는 contracts/ai v0.2 + backend 가 engine 에 못 닿은 경우(ENGINE_*)
CREATE TABLE argument_phrasing (
    run_id text PRIMARY KEY REFERENCES argument_run (run_id),
    status text NOT NULL CHECK (status IN ('done', 'skipped', 'failed')),
    reason_code text CHECK (reason_code IN (
        'RUN_BLOCKED', 'RUN_UNSUPPORTED', 'NOT_JUDGED', 'INPUT_INVALID', 'LLM_TIMEOUT', 'LLM_ERROR',
        'OUTPUT_REJECTED', 'ENGINE_DISABLED', 'ENGINE_TIMEOUT', 'ENGINE_ERROR')),
    problems jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(problems) = 'array'),
    citations jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(citations) = 'object'),
    model text,
    prompt_version text,
    duration_ms integer NOT NULL CHECK (duration_ms >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((status = 'done') = (reason_code IS NULL))
);
