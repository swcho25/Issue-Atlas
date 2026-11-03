-- 재실행 로그(5차 멘토링 표 2, 11/13): 같은 질문을 다시 돌리면 2회차 지표 3종(자동 채움률 · 수정 건수 · 응답 시간)이 나아지는지 본다.
-- C2 응답(result)에는 넣지 않는다(11/4 동결). 이 칸과 서버 로그로만 본다.
ALTER TABLE argument_run
    -- 같은 지역 × 카드 × 기간의 바로 앞 실행. 처음이면 null
    ADD COLUMN previous_run_id text REFERENCES argument_run (run_id),
    -- 논증 6칸 중 실행이 자동으로 채운 칸 수. 채움률 = filled_cells / 6. 이 칸 전 실행은 null
    ADD COLUMN filled_cells smallint CHECK (filled_cells BETWEEN 0 AND 6),
    -- 사람이 고친 칸 수. 검수 기능이 없어 지금은 null(0 과 다르다: 0 = 검수했고 고친 것 없음)
    ADD COLUMN edit_count integer CHECK (edit_count >= 0),
    -- POST /v1/questions 안에서 판정 · 결과 조립에 걸린 시간
    ADD COLUMN duration_ms integer CHECK (duration_ms >= 0);
