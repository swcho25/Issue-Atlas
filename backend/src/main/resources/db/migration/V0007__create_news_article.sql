-- 기사 본문 수집 결과(contracts/article). engine/pipeline/article 가 채운다.
-- 빅카인즈 기사 하나가 한 행이다. 본문은 빅카인즈가 아니라 원문 링크의 언론사 페이지에서 받는다.
-- C1 문서 칸(S15P31C108-100)이 생기기 전이라 raw_record 와 따로 두고, 나중에 news_id 로 잇는다.
CREATE TABLE news_article (
    news_id text PRIMARY KEY,
    -- 빅카인즈 검색 응답의 메타데이터
    provider text,
    title text,
    published_at timestamptz,
    category jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(category) = 'array'),
    -- 실제로 요청한 원문 주소. 쓸 수 있는 링크가 없으면 null
    url text,
    status text NOT NULL CHECK (status IN (
        'ok', 'NO_LINK', 'NO_REFERENCE', 'ROBOTS_DISALLOWED',
        'NETWORK_ERROR', 'HTTP_ERROR', 'NO_BODY', 'CONTENT_MISMATCH'
    )),
    http_status integer,
    fetched_at timestamptz,
    fetcher text NOT NULL,
    -- 본문은 받았을 때(ok)만 있다. 내부 분석(요약 · 분류)용이며 전문을 화면 · API 로 내보내지 않는다
    body text,
    -- 이 행이 마지막으로 바뀐 시각
    stored_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_news_article_body CHECK ((status = 'ok') = (body IS NOT NULL))
);
CREATE INDEX idx_news_article_published_at ON news_article (published_at);

-- 다음 단계(P3 요약, P4 분류)가 읽는 행: 본문을 받은 기사만.
CREATE VIEW news_article_ready AS
SELECT news_id, provider, title, published_at, category, url, fetched_at, fetcher, body
FROM news_article
WHERE status = 'ok';
