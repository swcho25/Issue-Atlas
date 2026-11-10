"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

보도자료 목록을 원본 장부(raw_record · job_run, V0002 · V0005)에 저장하고, P2 가 장부를 정제한다.
가상 게시판 HTML 을 쓴다.
"""

from datetime import date

import pytest

from pipeline.collect import press
from pipeline.collect.press import PressQuery, c1_pages, collect_pages, main, store_pages, to_c1
from pipeline.refine.store import refine_raw
from tests.test_collect_press import AT, Web, gwangju_page, rows_yeosu, yeosu_page
from tests_postgres.conftest import MIGRATIONS, fresh_schema

QUERY = PressQuery("yeosu", date(2025, 1, 1), date(2025, 12, 31))
V0044 = MIGRATIONS / "V0044__drop_press_release.sql"


@pytest.fixture
def press_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
            "V0010__create_press_release.sql",
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


OLD_COLUMNS = (
    "press_id, site, org, place_code_raw, category, department, title, published_on, url,"
    " license_type, storage_scope, collected_at, collector"
)


def old_table(conn, listings):
    """press-0.1.0 이 옛 표(V0010)에 넣던 모양 그대로 넣는다."""
    for r in listings:
        conn.execute(
            f"INSERT INTO press_release ({OLD_COLUMNS}) VALUES"
            " (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'press-0.1.0')",
            [r[c] for c in OLD_COLUMNS.replace(" ", "").split(",")[:-1]],
        )


def gwangju_listings(rows):
    web = Web({1: (200, gwangju_page(rows))}, robots=(404, b""))
    pages = collect_pages("gwangju", date(2022, 1, 1), date(2025, 12, 31), **web.options())
    return [r for page in pages for r in page]


def test_old_table_moves_to_raw_as_the_same_originals(press_db, monkeypatch, capsys):
    # 광주 누리집이 자동 요청을 막아(2026-11-02) 10/30 에 받은 옛 표를 옮긴다
    conn, connect = press_db
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    collected = gwangju_listings(
        [
            (3, "행정", "가상 보도 3", "2025-02-01"),
            (2, "", "가상 보도 2", "2024-12-31"),
            (1, "복지", "가상 보도 1", "2023-01-01"),
            (0, "행정", "범위 밖 보도", "2022-12-31"),
        ]
    )
    old_table(conn, collected)
    old_table(conn, [r | {"press_id": "yeosu:9", "site": "yeosu"} for r in collected[:1]])

    argv = ["--site", "gwangju", "--db", "--from-table"]
    assert main(argv, connect=connect) == 0
    assert '"inserted": 3' in capsys.readouterr().out
    rows = conn.execute(
        "SELECT payload->>'press_id', content_hash, c1_record->>'collected_at'"
        " FROM raw_record ORDER BY 1"
    ).fetchall()
    # 게시판에서 다시 받았을 때와 같은 원본 지문 · 그때의 수집 시각
    expected = sorted((r["press_id"], to_c1(r, "x")[1]["content_hash"], AT) for r in collected[:3])
    assert rows == expected
    assert conn.execute(
        "SELECT spec_id, status, stats->>'imported_from', stats->>'pages' FROM job_run"
    ).fetchall() == [("press_release_gwangju", "ok", "press_release", "2")]

    assert main(argv, connect=connect) == 0
    assert '"inserted": 0, "duplicates": 3' in capsys.readouterr().out
    result = refine_raw(conn)
    assert result["raw"] == 3 and result["status"] == {"pass": 3}


def test_old_table_is_dropped_only_after_every_row_is_in_raw(press_db, capsys):
    # V0044: 옮기지 않은 행이 하나라도 있으면 표를 남긴다(운영처럼 옮기기 전인 DB)
    conn, connect = press_db
    collected = gwangju_listings(
        [(2, "행정", "가상 보도 2", "2025-02-01"), (1, "복지", "가상 보도 1", "2024-01-01")]
    )
    old_table(conn, collected)
    old_table(conn, [collected[0] | {"press_id": "gwangju:99", "published_on": "2021-01-01"}])
    assert main(["--site", "gwangju", "--db", "--from-table"], connect=connect) == 0
    capsys.readouterr()

    conn.execute(V0044.read_text("utf-8"))
    assert conn.execute("SELECT to_regclass('press_release') IS NOT NULL").fetchone() == (True,)

    argv = ["--site", "gwangju", "--db", "--from-table", "--start", "2021-01-01"]
    assert main(argv, connect=connect) == 0
    capsys.readouterr()
    conn.execute(V0044.read_text("utf-8"))
    assert conn.execute("SELECT to_regclass('press_release')").fetchone() == (None,)
    assert conn.execute("SELECT count(*) FROM raw_record").fetchone() == (3,)

    # 지운 뒤 옛 표 옮기기는 원인을 알려 주고 실패한 실행으로 남긴다
    assert main(["--site", "gwangju", "--db", "--from-table"], connect=connect) == 1
    assert capsys.readouterr().err.strip() == "PRESS_OLD_TABLE_GONE"


def test_empty_old_table_is_a_failed_run(press_db, capsys):
    conn, connect = press_db
    assert main(["--site", "gwangju", "--db", "--from-table"], connect=connect) == 1
    assert capsys.readouterr().err.strip() == "PRESS_NO_ROWS"
    assert conn.execute("SELECT status, stats->>'error_code' FROM job_run").fetchone() == (
        "failed",
        "PRESS_NO_ROWS",
    )
