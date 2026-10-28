"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

보도자료 목록을 press_release(V0010)에 저장한다. 가상 게시판 HTML 을 쓴다.
"""

from datetime import date

import psycopg
import pytest

from pipeline.collect import press
from pipeline.collect.press import collect_pages, main, store_pages
from tests.test_collect_press import Web, rows_yeosu, yeosu_page
from tests_postgres.conftest import fresh_schema


@pytest.fixture
def press_db(postgis):
    yield from fresh_schema(postgis, ("V0010__create_press_release.sql",))


def run(conn, web):
    pages = collect_pages("yeosu", date(2025, 1, 1), date(2025, 12, 31), **web.options())
    return store_pages(conn, pages)


def test_store_inserts_then_only_changed_rows_update(press_db, monkeypatch):
    conn, _ = press_db
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    first = yeosu_page(rows_yeosu(3, ["2025-03-01", "2025-02-01"]))
    second = yeosu_page(rows_yeosu(1, ["2024-12-31"]))
    assert run(conn, Web({1: (200, first), 2: (200, second)})) == {
        "pages": 2,
        "seen": 2,
        "inserted": 2,
        "updated": 0,
        "unchanged": 0,
    }
    rows = conn.execute(
        "SELECT press_id, title, published_on, storage_scope FROM press_release ORDER BY press_id"
    ).fetchall()
    assert rows == [
        ("yeosu:2", "가상시 보도 2", date(2025, 2, 1), "metadata"),
        ("yeosu:3", "가상시 보도 3", date(2025, 3, 1), "metadata"),
    ]
    renamed = first.replace("가상시 보도 3".encode(), "가상시 보도 3 (정정)".encode())
    stats = run(conn, Web({1: (200, renamed), 2: (200, second)}))
    assert (stats["inserted"], stats["updated"], stats["unchanged"]) == (0, 1, 1)
    assert conn.execute(
        "SELECT title FROM press_release WHERE press_id = 'yeosu:3'"
    ).fetchone() == ("가상시 보도 3 (정정)",)


def test_failure_keeps_earlier_pages(press_db, monkeypatch, capsys):
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
    assert conn.execute("SELECT count(*) FROM press_release").fetchone() == (2,)


def test_table_rejects_body_storage_scope(press_db):
    conn, _ = press_db
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO press_release (press_id, site, org, place_code_raw, title, published_on,"
            " url, license_type, storage_scope, collected_at, collector) VALUES"
            " ('yeosu:1', 'yeosu', '여수시', '46130', 't', '2025-01-01', 'u', 'KOGL-1', 'full',"
            " now(), 'test')"
        )
