"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

에어코리아 시간값은 normalized_record 에 넣지 않고 측정소 × 지표 × 월 표(air_monthly, V0009)에만
저장한다. 값은 직접 만든 가상 장부다.
"""

import copy
import json
from datetime import datetime, timedelta, timezone
from itertools import count
from pathlib import Path

from psycopg.types.json import Jsonb

from pipeline.refine.store import refine_raw

ROOT = Path(__file__).resolve().parents[2]
BASE = json.loads((ROOT / "contracts/c1/examples/airkorea-measure.json").read_text("utf-8"))
KST = timezone(timedelta(hours=9))
SPEC = "airkorea_final_yeosu_gwangju"
HASHES = count(1)


def setup_source(conn):
    conn.execute(
        "INSERT INTO source VALUES ('airkorea_final', '에어코리아 확정', '한국환경공단', 'KOGL-3', "
        "'full', NULL, NULL)"
    )
    conn.execute(
        "INSERT INTO source_spec (spec_id, source_id, method, evidence_class) "
        "VALUES (%s, 'airkorea_final', 'file', 'statistics')",
        (SPEC,),
    )
    conn.execute(
        "INSERT INTO job_run (job_run_id, spec_id, collector_version, started_at) "
        "VALUES ('run_air', %s, '0.1.0', now())",
        (SPEC,),
    )


def ledger(start, value, *, provisional=False, collected="2026-01-01T00:00:00+09:00"):
    """측정소 324115(서석동) PM2.5 한 시간 [start, start + 1시간). value None 은 원천 결측."""
    end = start + timedelta(hours=1)
    raw_time = int(start.strftime("%Y%m%d")) * 100 + start.hour + 1  # 원천 「01」~「24」시
    r = copy.deepcopy(BASE) | {
        "source_id": "airkorea_final",
        "spec_id": SPEC,
        "raw_url": "https://www.airkorea.or.kr/web/last_amb_hour_data",
        "file_name": None,
        "content_hash": f"sha256:{next(HASHES):064x}",
        "collected_at": collected,
        "observed_at": end.isoformat(),
        "observed_period_start": start.isoformat(),
        "observed_period_end": end.isoformat(),
        "place_code_raw": "324115",
        "indicator_id": "air_pm25",
        "value": value,
        "missing_reason": None if value is not None else "not_published",
        "locator": {
            "측정소코드": "324115",
            "측정소명": "서석동",
            "측정일시": raw_time,
            "column": "초미세먼지(PM25)",
        },
        "dedup_key": f"airkorea_final:324115:PM25:{raw_time}" + (":provisional" * provisional),
        "run_id": "run_air",
        "is_provisional": provisional,
    }
    return r


def hours(year, month, n):
    first = datetime(year, month, 1, tzinfo=KST)
    return [first + timedelta(hours=i) for i in range(n)]


def add(conn, ledgers):
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO raw_record (job_run_id, spec_id, raw_url, content_hash, collected_at, "
            "c1_record) VALUES ('run_air', %s, %s, %s, %s, %s)",
            [(SPEC, r["raw_url"], r["content_hash"], r["collected_at"], Jsonb(r)) for r in ledgers],
        )


def monthly(conn):
    return conn.execute(
        "SELECT to_char(month_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), "
        "to_char(month_end AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), month_hours, "
        "valid_hours, held_hours, value_mean, value_min, value_max, has_provisional "
        "FROM air_monthly ORDER BY month_start"
    ).fetchall()


def test_monthly_mean_uses_valid_hours_of_each_korean_month(refine_db):
    conn, _ = refine_db
    setup_source(conn)
    # 1월: 처음 100시간은 결측, 나머지는 10 · 30 이 번갈아 → 유효 644시간, 평균 20
    january = [
        ledger(t, None if i < 100 else 10 + 20 * (i % 2)) for i, t in enumerate(hours(2024, 1, 744))
    ]
    # 2월(696시간): 521시간만 유효 — 75%(522시간)에 한 시간 모자라 월평균을 내지 않는다
    february = [ledger(t, 5 if i < 521 else None) for i, t in enumerate(hours(2024, 2, 696))]
    add(conn, january + february)

    stats = refine_raw(conn)

    # 한 달이 하루 묶음 31개로 나뉘어 정제돼도 한 행으로 모인다
    assert stats["air_monthly"] == 2 and stats["status"] == {"pass": 1440}
    # 한국 시각으로 자른다: UTC 로 자르면 2월 1일 0~8시가 1월로 가 1월 유효 시간이 653 이 된다
    assert monthly(conn) == [
        ("2024-01-01 00:00", "2024-02-01 00:00", 744, 644, 0, 20, 10, 30, False),
        ("2024-02-01 00:00", "2024-03-01 00:00", 696, 521, 0, None, 5, 5, False),
    ]
    name, unit = conn.execute("SELECT station_name, unit FROM air_monthly LIMIT 1").fetchone()
    assert (name, unit) == ("서석동", "µg/m³")
    # 시간값은 정제 행으로 저장하지 않는다
    assert stats["inserted"] == 0
    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (0,)


def test_confirmed_data_replaces_provisional_hours(refine_db):
    conn, _ = refine_db
    setup_source(conn)
    march = hours(2024, 3, 744)
    add(conn, [ledger(t, 10, provisional=True) for t in march])
    refine_raw(conn)
    assert monthly(conn) == [
        ("2024-03-01 00:00", "2024-04-01 00:00", 744, 744, 0, 10, 10, 10, True)
    ]

    # 나중에 받은 확정 자료가 같은 시간의 최신본이 된다. 두 판을 같이 세지 않는다
    later = "2026-02-01T00:00:00+09:00"
    add(conn, [ledger(t, 20, collected=later) for t in march])
    stats = refine_raw(conn)

    assert stats["air_monthly"] == 1
    assert monthly(conn) == [
        ("2024-03-01 00:00", "2024-04-01 00:00", 744, 744, 0, 20, 20, 20, False)
    ]


def test_conflicting_hour_is_held_not_averaged(refine_db):
    conn, _ = refine_db
    setup_source(conn)
    april = hours(2024, 4, 720)
    # 첫 시간에 같은 dedup_key 로 값이 다른 원본이 하나 더 있다
    # → 두 판 모두 보류, 그 시간은 평균에서 빠진다
    add(conn, [ledger(t, 10) for t in april] + [ledger(april[0], 99)])

    stats = refine_raw(conn)

    assert stats["status"] == {"pass": 719, "held": 2}
    assert monthly(conn) == [
        ("2024-04-01 00:00", "2024-05-01 00:00", 720, 719, 1, 10, 10, 10, False)
    ]


def test_unreadable_time_is_counted_but_not_placed(refine_db):
    conn, _ = refine_db
    setup_source(conn)
    add(conn, [ledger(hours(2024, 5, 1)[0], 10) | {"observed_period_start": "언제인지 모름"}])

    stats = refine_raw(conn)

    assert (stats["air_monthly"], stats["air_unplaced"]) == (0, 1)
    assert monthly(conn) == []


def test_running_again_gives_the_same_months(refine_db):
    conn, _ = refine_db
    setup_source(conn)
    add(conn, [ledger(t, i % 7) for i, t in enumerate(hours(2024, 6, 720))])
    refine_raw(conn)
    before = monthly(conn)

    refine_raw(conn)

    assert monthly(conn) == before
