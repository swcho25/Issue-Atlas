"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

수집기로 raw_record 를 채우고, P1 이 장부(c1_record)를 같이 저장한 상황을 흉내 낸 뒤
P2 가 그 장부를 읽어 정제하고 normalized_record 에 저장한다. P2 는 장부를 만들지 않는다.
"""

import copy
import json
from pathlib import Path

import pytest

from pipeline.collect.kosis import Query
from pipeline.collect.run import collect
from pipeline.collect.store import PostgresStore
from pipeline.refine.__main__ import main
from pipeline.refine.store import RefineStoreError, refine_raw

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT / "contracts/c1/examples/raw/kosis-net-migration.json").read_text("utf-8"))
QUERY = Query(regions=("46130",))
YEAR_2023 = "2023-01-01T00:00:00+09:00"


def collect_rows(conn, tmp_path, rows, ledger=True):
    """수집기를 돌린다. 수집기가 장부(c1_record)를 원본과 함께 저장한다.

    ledger=False 는 장부 칸이 생기기 전에 저장된 원본을 흉내 내려고 장부를 비운다.
    """
    output = tmp_path / "c1.json"
    collect(QUERY, "fixture", PostgresStore(conn), output, fetch=lambda *a: copy.deepcopy(rows))
    if not ledger:
        conn.execute("UPDATE raw_record SET c1_record = NULL")


def changed_2023(dt, published):
    rows = copy.deepcopy(ROWS)
    rows[0]["DT"] = dt
    rows[0]["LST_CHN_DE"] = published
    return rows


def ready_2023(conn):
    return conn.execute(
        "SELECT value, validation_status, is_latest FROM normalized_ready "
        "WHERE place_code_raw = '46130' AND observed_period_start = %s",
        (YEAR_2023,),
    ).fetchall()


def snapshot(conn):
    return conn.execute("SELECT * FROM normalized_record ORDER BY content_hash").fetchall()


def test_yeosu_kosis_goes_from_ledger_to_ready(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)

    stats = refine_raw(conn)

    assert stats["inserted"] == 3 and stats["status"] == {"pass": 3}
    assert ready_2023(conn) == [(-747, "pass", True)]
    # 정제 행마다 원본 raw_record 를 content_hash 로 찾을 수 있다
    linked = conn.execute(
        "SELECT count(*) FROM normalized_record n JOIN raw_record r USING (content_hash)"
    ).fetchone()
    assert linked == (3,)


def test_raw_without_ledger_is_skipped_and_counted(refine_db, tmp_path):
    # P1 이 장부를 아직 저장하지 않으면 P2 는 장부를 만들지 않고 건너뛴다
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS, ledger=False)

    stats = refine_raw(conn)

    assert stats["skipped"] == {"S01": 3} and stats["inserted"] == 0
    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (0,)


def test_running_again_on_the_same_ledger_changes_nothing(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    refine_raw(conn)
    before = snapshot(conn)

    again = refine_raw(conn)

    assert (again["inserted"], again["updated"], again["unchanged"]) == (0, 0, 3)
    assert snapshot(conn) == before  # refined_at 까지 그대로


def test_revision_keeps_old_row_and_only_newest_is_ready(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    refine_raw(conn)
    # KOSIS 가 2023 값을 고쳐 다시 공표: 재수집 실행에서는 바뀐 1행만 raw 로 새로 저장된다
    collect_rows(conn, tmp_path, changed_2023("-748", "2026-10-23"))

    stats = refine_raw(conn)

    assert (stats["inserted"], stats["updated"], stats["unchanged"]) == (1, 1, 2)
    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (4,)
    assert ready_2023(conn) == [(-748, "pass", True)]
    assert conn.execute("SELECT count(*) FROM normalized_ready").fetchone() == (3,)


def test_conflicting_raw_rows_are_both_stored_held_and_not_ready(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    # 같은 공표일인데 값이 다르다 → 같은 dedup_key, 다른 원본
    collect_rows(conn, tmp_path, changed_2023("-700", ROWS[0]["LST_CHN_DE"]))

    stats = refine_raw(conn)

    assert stats["status"] == {"pass": 2, "held": 2}
    held = conn.execute(
        "SELECT issues FROM normalized_record WHERE validation_status = 'held'"
    ).fetchall()
    assert held == [([{"code": "DEDUP_KEY_CONFLICT", "field": "dedup_key"}],)] * 2
    assert ready_2023(conn) == []


def test_ledger_whose_hash_is_not_its_raw_stops_without_saving(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    conn.execute(
        'UPDATE raw_record SET c1_record = c1_record || \'{"content_hash": "sha256:other"}\' '
        "WHERE id = (SELECT min(id) FROM raw_record)"
    )

    with pytest.raises(RefineStoreError, match="C1_HASH_MISMATCH"):
        refine_raw(conn)

    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (0,)


def test_cli_db_mode_refines_and_prints_counts(refine_db, tmp_path, capsys):
    conn, connect = refine_db
    collect_rows(conn, tmp_path, ROWS)
    capsys.readouterr()

    assert main(["--db"], connect=connect) == 0

    printed = json.loads(capsys.readouterr().out)
    assert printed["raw"] == 3 and printed["inserted"] == 3 and printed["skipped"] == {}
