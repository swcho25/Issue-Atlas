"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

수집기로 raw_record 를 채우고, P1 이 장부(c1_record)를 같이 저장한 상황을 흉내 낸 뒤
P2 가 그 장부를 읽어 정제하고 normalized_record 에 저장한다. P2 는 장부를 만들지 않는다.
"""

import copy
import json
from pathlib import Path

import pytest
from psycopg.types.json import Jsonb

from pipeline.collect.kosis import Query
from pipeline.collect.run import collect
from pipeline.collect.store import PostgresStore
from pipeline.refine import store
from pipeline.refine.__main__ import main
from pipeline.refine.run import refine_records
from pipeline.refine.store import RefineStoreError, refine_raw
from tests.samples import NEWS, STATION

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
    assert stats["air_monthly"] == 0  # 월별 집계는 에어코리아 시간값만 묶는다
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


def add_raw(conn, ledger):
    """수집기를 거치지 않고 원본 · 장부 한 행을 더한다 (첫 원본 행의 실행 · spec 을 빌린다)."""
    conn.execute(
        "INSERT INTO raw_record (job_run_id, spec_id, raw_url, file_name, content_hash, "
        "payload, collected_at, c1_record) "
        "SELECT job_run_id, spec_id, raw_url, file_name, %s, payload, collected_at, %s "
        "FROM raw_record ORDER BY id LIMIT 1",
        (ledger["content_hash"], Jsonb(ledger)),
    )


def ledger_of(conn, year):
    return conn.execute(
        "SELECT c1_record FROM raw_record WHERE c1_record -> 'locator' ->> 'prd_de' = %s "
        "ORDER BY id LIMIT 1",
        (year,),
    ).fetchone()[0]


def variant(base, n, **changes):
    return {**copy.deepcopy(base), "content_hash": f"sha256:{n:064x}", **changes}


def station():
    return variant(STATION[0], 1)


def day(record):
    return (record.get("observed_period_start") or "")[:10]


def spy_refine(monkeypatch, fail_after=None):
    """정제 호출마다 받은 레코드의 관측 일을 남긴다. fail_after 번째 뒤 호출에서 멈춘다."""
    calls = []

    def spy(records):
        if fail_after is not None and len(calls) >= fail_after:
            raise RuntimeError("STOP")
        calls.append(sorted({day(r) for r in records}))
        return refine_records(records)

    monkeypatch.setattr(store, "refine_records", spy)
    return calls


def test_each_observed_day_is_refined_separately(refine_db, tmp_path, monkeypatch):
    # 메모리에는 한 번에 하루 치 장부만 올린다. 시각 없는 측정소 메타는 한 묶음
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    add_raw(conn, station())
    calls = spy_refine(monkeypatch)

    stats = refine_raw(conn)

    assert calls == [[""], ["2023-01-01"], ["2024-01-01"], ["2025-01-01"]]
    assert stats["buckets"] == 4 and stats["inserted"] == 4


def test_refining_by_day_gives_the_same_rows_as_all_at_once(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    # 2023: 고친 판(최신본) · 같은 dedup_key 에 값만 다른 원본(충돌)
    collect_rows(conn, tmp_path, changed_2023("-748", "2026-10-23"))
    collect_rows(conn, tmp_path, changed_2023("-700", ROWS[0]["LST_CHN_DE"]))
    # 2024 와 dedup_key 가 같은데 시각이 깨져 다른 묶음('')으로 갈 레코드 → 충돌을 놓치면 안 된다
    y2024 = ledger_of(conn, "2024")
    add_raw(conn, variant(y2024, 2, value=-1, observed_period_start="언제인지 모름"))
    # 2025 와 관측 칸이 같은데 다른 날로 적힌 판 → 최신본이 둘이 되면 안 된다
    y2025 = ledger_of(conn, "2025")
    later = {
        "dedup_key": y2025["dedup_key"] + ":2026-10-25",
        "published_at": "2026-10-25T00:00:00+09:00",
        "observed_period_start": "2025-02-01T00:00:00+09:00",
        "value": -931,
    }
    add_raw(conn, variant(y2025, 3, **later))
    add_raw(conn, station())
    ledgers = [row[0] for row in conn.execute("SELECT c1_record FROM raw_record ORDER BY id")]

    stats = refine_raw(conn)

    expected = {r["content_hash"]: json.loads(json.dumps(r)) for r in refine_records(ledgers)}
    stored = dict(conn.execute("SELECT content_hash, record FROM normalized_record").fetchall())
    assert stored == expected
    # '' (측정소) · 2023-01-01 · 모은 묶음. 2024 · 2025 는 키가 갈라져 모은 묶음으로 갔다
    assert stats["buckets"] == 3
    latest_2025 = conn.execute(
        "SELECT count(*) FROM normalized_record WHERE obs_key = %s AND is_latest",
        (expected[variant(y2025, 3)["content_hash"]]["obs_key"],),
    ).fetchone()
    assert latest_2025 == (1,)
    conflict = conn.execute(
        "SELECT count(*) FROM normalized_record "
        "WHERE dedup_key = %s AND validation_status = 'held'",
        (y2024["dedup_key"],),
    ).fetchone()
    assert conflict == (2,)


def test_hash_mismatch_in_a_later_day_stops_before_any_day_is_saved(refine_db, tmp_path):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    conn.execute(
        'UPDATE raw_record SET c1_record = c1_record || \'{"content_hash": "sha256:other"}\' '
        "WHERE c1_record -> 'locator' ->> 'prd_de' = '2025'"
    )

    with pytest.raises(RefineStoreError, match="C1_HASH_MISMATCH"):
        refine_raw(conn)

    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (0,)


def test_days_are_committed_one_by_one(refine_db, tmp_path, monkeypatch):
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    spy_refine(monkeypatch, fail_after=1)

    with pytest.raises(RuntimeError, match="STOP"):
        refine_raw(conn)

    # 앞 묶음(2023)은 저장됐다. 같은 연결로 다시 돌리면 나머지를 채운다
    assert conn.execute("SELECT count(*) FROM normalized_record").fetchone() == (1,)
    monkeypatch.undo()
    stats = refine_raw(conn)
    assert (stats["inserted"], stats["unchanged"]) == (2, 1)


def test_article_fetched_twice_leaves_one_ready_row_with_its_body(refine_db, tmp_path):
    # 같은 기사를 실패 → 성공으로 두 번 받았다. 원본 · 정제 행은 둘 다 남고
    # 다음 단계는 본문 있는 1건만 본다
    conn, _ = refine_db
    collect_rows(conn, tmp_path, ROWS)
    article = {**NEWS[0], "license_type": "BIGKINDS-이용약관", "place_code_raw": ""}
    failed = variant(article, 11, storage_scope="metadata", dedup_key="bigkinds:a:NO_BODY")
    failed["document"].update(body=None, fetch={**failed["document"]["fetch"], "status": "NO_BODY"})
    ok = variant(article, 12, collected_at="2026-10-27T00:00:00Z", dedup_key="bigkinds:a:ok")
    for ledger in (failed, ok):
        add_raw(conn, ledger)

    stats = refine_raw(conn)

    assert stats["status"] == {"pass": 4, "held": 1}  # 본문 못 받은 판은 보류
    stored = conn.execute(
        "SELECT dedup_key, is_latest FROM normalized_record "
        "WHERE dedup_key LIKE 'bigkinds:%' ORDER BY dedup_key"
    ).fetchall()
    assert stored == [("bigkinds:a:NO_BODY", False), ("bigkinds:a:ok", True)]
    ready = conn.execute(
        "SELECT storage_scope, place_code_raw, record -> 'document' ->> 'body' "
        "FROM normalized_ready WHERE dedup_key LIKE 'bigkinds:%'"
    ).fetchall()
    assert ready == [("full", "", ok["document"]["body"])]
