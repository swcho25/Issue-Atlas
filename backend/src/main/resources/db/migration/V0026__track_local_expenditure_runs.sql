-- 세출 수집 실행과 최신본(contracts/expenditure v0.2, S15P31C108-173).
-- 행 ID(expenditure_id)는 회계연도 + 원천 13칸의 지문이라, 같은 사업의 금액이 바뀐 파일을 다시 넣으면
-- 새 행이 생기고 옛 행도 남는다. 수집기가 실행(job_run)마다 그 파일에 있던 행에 실행 ID 를 다시 찍는다.
-- 이 칸이 비어 있는 행은 실행 기록 전에 넣은 것이다.
ALTER TABLE local_expenditure ADD COLUMN job_run_id text REFERENCES job_run (job_run_id);
CREATE INDEX idx_local_expenditure_run ON local_expenditure (fiscal_year, job_run_id);

-- 회계연도마다 마지막 실행이 찍은 행만. 파일 하나를 한 트랜잭션으로 넣으므로 행이 있는 실행은 늘 파일 전체다.
-- 그 해에 실행 기록이 없으면(이 마이그레이션 전에 넣은 해) 그 해의 모든 행.
CREATE VIEW local_expenditure_latest AS
WITH latest AS (
    SELECT DISTINCT ON (r.fiscal_year) r.fiscal_year, r.job_run_id
    FROM (SELECT DISTINCT fiscal_year, job_run_id FROM local_expenditure WHERE job_run_id IS NOT NULL) r
    JOIN job_run j USING (job_run_id)
    ORDER BY r.fiscal_year, j.started_at DESC
)
SELECT e.*
FROM local_expenditure e
LEFT JOIN latest l USING (fiscal_year)
WHERE l.job_run_id IS NULL OR e.job_run_id = l.job_run_id;
