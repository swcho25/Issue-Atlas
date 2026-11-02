"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

보도자료 목록을 원본 장부(raw_record · job_run, V0002 · V0005)에 저장하고, P2 가 장부를 정제한다.
가상 게시판 HTML 을 쓴다.
"""

from datetime import date

import pytest

from pipeline.collect import press
from pipeline.collect.press import PressQuery, c1_pages, collect_pages, main, store_pages
from pipeline.refine.store import refine_raw
from tests.test_collect_press import Web, rows_yeosu, yeosu_page
from tests_postgres.conftest import fresh_schema

QUERY = PressQuery("yeosu", date(2025, 1, 1), date(2025, 12, 31))


@pytest.fixture
def press_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
        ),
    )


def run(conn, web, run_id):
    pages = collect_pages("yeosu", QUERY.start, QUERY.end, **web.options())
    return store_pages(conn, QUERY, c1_pages(pages, run_id), run_id)


def test_posts_are_raw_rows_and_only_changed_posts_add_revisions(press_db, monkeypatch):
    conn, _ = press_db
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    first = yeosu_page(rows_yeosu(3, ["2025-03-01", "2025-02-01"]))
    second = yeosu_page(rows_yeosu(1, ["2024-12-31"]))
    stats = run(conn, Web({1: (200, first), 2: (200, second)}), "press_run_1")
    assert {k: stats[k] for k in ("pages", "seen", "inserted", "duplicates")} == {
        "pages": 2,
        "seen": 2,
        "inserted": 2,
        "duplicates": 0,
    }
    assert conn.execute("SELECT source_id, license_type, storage_scope FROM source").fetchall() == [
        ("press_yeosu", "KOGL-4", "metadata")
    ]
    assert conn.execute("SELECT method, evidence_class FROM source_spec").fetchall() == [
        ("board", "documents")
    ]
    rows = conn.execute(
        "SELECT payload->>'press_id', c1_record->'document'->>'title',"
        " c1_record->>'content_hash' = content_hash FROM raw_record ORDER BY 1"
    ).fetchall()
    assert rows == [("yeosu:2", "가상시 보도 2", True), ("yeosu:3", "가상시 보도 3", True)]

    renamed = first.replace("가상시 보도 3".encode(), "가상시 보도 3 (정정)".encode())
    stats = run(conn, Web({1: (200, renamed), 2: (200, second)}), "press_run_2")
    assert (stats["inserted"], stats["duplicates"]) == (1, 1)
    assert conn.execute(
        "SELECT job_run_id, status, stats->>'inserted' FROM job_run ORDER BY started_at"
    ).fetchall() == [("press_run_1", "ok", "2"), ("press_run_2", "ok", "1")]

    result = refine_raw(conn)
    assert result["raw"] == 3 and not result["skipped"]
    ready = conn.execute(
        "SELECT record->'document'->>'title' FROM normalized_ready"
        " WHERE record->'document'->>'kind' = 'press_release' ORDER BY 1"
    ).fetchall()
    assert ready == [("가상시 보도 2",), ("가상시 보도 3 (정정)",)]


def test_failure_keeps_earlier_pages_and_records_failed_run(press_db, monkeypatch, capsys):
    conn, connect = press_db
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web(
        {
            1: (200, yeosu_page(rows_yeosu(3, ["2025-03-01", "2025-02-01"]))),
            2: (503, b""),
        }
    )
    assert main(["--site", "yeosu", "--db"], connect=connect, **web.options()) == 1
    assert capsys.readouterr().err.strip() == "PRESS_HTTP_503"
    assert conn.execute("SELECT count(*) FROM raw_record").fetchone() == (2,)
    assert conn.execute("SELECT status, stats->>'error_code' FROM job_run").fetchone() == (
        "failed",
        "PRESS_HTTP_503",
    )


def test_db_run_also_writes_output_copy(press_db, monkeypatch, capsys, tmp_path):
    # 서버 실행기(deploy/collector/run_collector.py)는 언제나 --output 을 붙인다
    conn, connect = press_db
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web({1: (200, yeosu_page(rows_yeosu(3, ["2025-03-01", "2025-02-01"])))})
    path = tmp_path / "c1.json"
    argv = ["--site", "yeosu", "--db", "--output", str(path)]
    assert main(argv, connect=connect, **web.options()) == 0
    assert '"inserted": 2' in capsys.readouterr().out
    assert len(path.read_bytes().splitlines()) == 2
    assert conn.execute("SELECT count(*) FROM raw_record").fetchone() == (2,)
