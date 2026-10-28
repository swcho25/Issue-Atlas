-- 지자체 보도자료 목록 수집 결과(contracts/press). engine/pipeline/collect/press.py 가 채운다.
-- 보도자료 하나가 한 행이다. 여수시는 공공누리 4유형, 광주광역시는 공공누리 표시가 없어
-- 본문 없이 목록에 보이는 메타데이터(제목 · 분류 · 담당부서 · 등록일 · 링크)만 둔다.
-- C1 문서 칸(S15P31C108-100)이 생기기 전이라 raw_record 와 따로 둔다.
CREATE TABLE press_release (
    -- '<site>:<게시판 글 번호>' (예: yeosu:584169, gwangju:22211)
    press_id text PRIMARY KEY,
    site text NOT NULL CHECK (site IN ('yeosu', 'gwangju')),
    org text NOT NULL,
    -- 발행 기관의 KOSIS 지역 코드(옛 코드). 여수시 46130, 광주광역시 29
    place_code_raw text NOT NULL,
    category text,
    department text,
    title text NOT NULL,
    -- 게시판의 등록일(한국 날짜). 시각은 목록에 없다
    published_on date NOT NULL,
    -- 글 보기 주소(목록 검색 조건 없이)
    url text NOT NULL,
    license_type text NOT NULL,
    storage_scope text NOT NULL CHECK (storage_scope = 'metadata'),
    collected_at timestamptz NOT NULL,
    collector text NOT NULL,
    -- 이 행이 마지막으로 바뀐 시각
    stored_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_press_release_place_published ON press_release (place_code_raw, published_on);
