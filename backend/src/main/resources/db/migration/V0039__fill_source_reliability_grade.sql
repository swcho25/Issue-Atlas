-- 출처 등급(S15P31C108-232). 질문 실행은 등급이 있는 출처로만 통계 · 기존 대응 근거를 만들고(QuestionRepository),
-- 한정어는 A · B 출처 수를 센다(contracts/c2 「근거 충실도 규칙표」). 지금까지 모든 출처가 null 이라 근거가 붙지 않았다.
-- 기준: A = 국가 · 공공기관이 측정 · 집계한 원자료(승인통계 · 측정망), B = 기관이 발표 · 공시한 행정 자료,
--       C = 언론 보도. 출처별 값과 이유는 contracts/database 「출처 등급」.
-- 수집기는 출처 행을 등급 없이 넣는다(engine store.start, ON CONFLICT DO NOTHING). 그래서 지금 있는 행을 채우고,
-- 나중에 들어오는 행도 등급이 비어 있으면 같은 값으로 채운다. 표에 없는 출처는 그대로 null(근거를 만들지 않음).
-- 등급을 바꿀 때는 새 마이그레이션에서 이 함수와 이미 있는 행을 함께 고친다.
CREATE FUNCTION source_default_grade(id text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE id
        WHEN 'S01' THEN 'A'               -- KOSIS 인구이동 · 주민등록인구(국가승인통계)
        WHEN 'airkorea_final' THEN 'A'    -- 에어코리아 확정자료(한국환경공단 측정망)
        WHEN 'airkorea_station' THEN 'A'  -- 에어코리아 측정소 정보(같은 측정망)
        WHEN 'lofin' THEN 'B'             -- 지방재정365 세부사업별 세출(행정안전부 공시)
        WHEN 'youthcenter' THEN 'B'       -- 온통청년 청년정책(한국고용정보원 게시)
        WHEN 'press_yeosu' THEN 'B'       -- 여수시 보도자료(기관 발표)
        WHEN 'press_gwangju' THEN 'B'     -- 광주광역시 보도자료(기관 발표)
        WHEN 'bigkinds' THEN 'C'          -- 빅카인즈 뉴스(언론 보도)
    END
$$;

UPDATE source SET reliability_grade = source_default_grade(source_id) WHERE reliability_grade IS NULL;

-- 넣을 때만 채운다. 나중에 사람이 등급을 비우거나 바꾼 값은 건드리지 않는다
CREATE FUNCTION source_fill_grade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.reliability_grade := coalesce(NEW.reliability_grade, source_default_grade(NEW.source_id));
    RETURN NEW;
END $$;
CREATE TRIGGER trg_source_fill_grade BEFORE INSERT ON source
    FOR EACH ROW EXECUTE FUNCTION source_fill_grade();
