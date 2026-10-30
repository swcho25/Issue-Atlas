-- 지방재정365 「연도별 세부사업별 세출현황」(contracts/expenditure). engine/pipeline/collect/lofin.py 가 채운다.
-- 세부사업 한 줄이 한 행이다. 카드 근거 ③ 「기존 대응」(세출, SP09 · SP24)의 원천이다.
-- 금액이 여러 개(예산 재원별 · 지출 · 잔액)라 C1 관측값 · 문서 어느 쪽에도 맞지 않아 raw_record 와 따로 둔다.
CREATE TABLE local_expenditure (
    -- 회계연도 + 원천 행 13칸의 sha256. 같은 파일을 다시 넣어도 같은 행
    expenditure_id text PRIMARY KEY CHECK (expenditure_id ~ '^sha256:[0-9a-f]{64}$'),
    fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
    -- 원천의 지역(시도) · 자치단체(본청 · 구 · 시 · 군) 글자 그대로
    region text NOT NULL,
    government text NOT NULL,
    -- 자치단체의 KOSIS 옛 지역 코드. 광주 본청 29, 광주 5구 29110 등, 여수시 46130
    place_code_raw text NOT NULL,
    account text NOT NULL,
    project_name text NOT NULL,
    -- 원 단위. 예산현액 = 국비 + 시도비 + 시군구비 + 기타
    budget_total bigint NOT NULL,
    budget_national bigint NOT NULL,
    budget_province bigint NOT NULL,
    budget_local bigint NOT NULL,
    budget_other bigint NOT NULL,
    expenditure bigint NOT NULL,
    balance bigint NOT NULL,
    -- 기능별 분류(분야 14 · 부문 54)
    field text,
    sector text,
    -- 원천 파일 이름(지방재정365 통합자료실 첨부). 집행일자는 해당 연도 12월 31일
    file_name text NOT NULL,
    license_type text NOT NULL,
    storage_scope text NOT NULL CHECK (storage_scope = 'full'),
    collected_at timestamptz NOT NULL,
    collector text NOT NULL
);
CREATE INDEX idx_local_expenditure_place_year ON local_expenditure (place_code_raw, fiscal_year);
