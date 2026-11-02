-- 근거 기사 목록(C2 articles[])의 원문 링크를 빅카인즈 원본 레코드에서 news_id 로 찾는다.
-- 인덱스가 없으면 기사 한 건마다 normalized_record 를 다 훑는다(로컬 1만 행에서 건당 약 0.1초).
CREATE INDEX idx_normalized_record_news_id ON normalized_record ((record -> 'locator' ->> 'news_id'));
