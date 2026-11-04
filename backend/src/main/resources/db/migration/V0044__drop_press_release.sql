-- 옛 보도자료 표 정리(S15P31C108-240). 보도자료는 C1 문서로 원본 장부 → 정제에 들어가고(-172, contracts/press v0.2),
-- 광주광역시는 옛 표에서 옮겼고(-187), 검수도 정제 행을 가리킨다(-237, V0043). 그래서 옛 표는 중복이다.
-- 다만 아직 옮기지 않은 DB(운영처럼 develop 반영 전에 옛 수집기로 받은 곳)에서는 이 표가 유일한 사본일 수 있다.
-- 광주광역시 누리집은 자동 요청을 막아(2026-11-02) 다시 받기도 어렵다. 그래서 옛 표의 모든 행이
-- 원본 장부(press_yeosu · press_gwangju 출처, payload press_id)에 있을 때만 지운다. 하나라도 없으면 표를 남기고 알림만 낸다
-- → `press --site <게시판> --db --from-table` 로 옮긴 뒤 새 마이그레이션에서 지운다.
DO $$
DECLARE
    missing bigint;
BEGIN
    IF to_regclass('press_release') IS NULL THEN
        RETURN;
    END IF;
    SELECT count(*) INTO missing
    FROM press_release p
    WHERE NOT EXISTS (
        SELECT 1
        FROM raw_record w
        JOIN source_spec sp ON sp.spec_id = w.spec_id
        WHERE sp.source_id IN ('press_yeosu', 'press_gwangju')
          AND w.payload ->> 'press_id' = p.press_id);
    IF missing > 0 THEN
        RAISE NOTICE 'press_release 를 남긴다: 원본 장부에 없는 옛 보도자료 % 건', missing;
        RETURN;
    END IF;
    DROP TABLE press_release;
END $$;
