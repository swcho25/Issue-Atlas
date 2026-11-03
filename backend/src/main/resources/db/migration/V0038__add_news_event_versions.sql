-- 기사 사건 표(news_event)에 「만든 판」 칸을 더한다(contracts/p3 v0.11). 처음 V0037 로 병합했다가
-- V0037__create_admin_reviews 와 번호가 겹쳐 V0038 로 옮겼다(dev · 운영 어디에도 적용 전). LLM 이 만든 요약 · 지역 · 시간을
-- 어느 프롬프트 판과 모델로 뽑았는지 남겨, 규칙 판정과 구분하고 판이 바뀌면 다시 돌릴 기사를 고를 수 있게 한다.
-- null = 판을 기록하기 전에 넣은 행(2026-11-01 p3-region-lab 적재 — 지역 p9.1 · 요약 s1 · Qwen2.5-32B-Instruct-AWQ).
-- 운영 DB 에 다른 경로로 들어간 행이 있을 수 있어 여기서 채우지 않는다.
ALTER TABLE news_event
    -- 지역 질문 프롬프트 판(p9.1 …)
    ADD COLUMN prompt_version text,
    -- 요약 · 사건 시간 질문 판(s1.1 …)
    ADD COLUMN summary_version text,
    -- 추출에 쓴 모델 이름(.env P3_LLM_MODEL)
    ADD COLUMN model text;
