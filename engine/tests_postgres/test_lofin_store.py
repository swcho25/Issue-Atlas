"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

세부사업별 세출현황을 local_expenditure(V0015)에 저장하고 실행 이력(job_run, V0002)을 남긴다.
최신본 뷰(V0026)는 회계연도마다 마지막 파일의 행만 낸다. 가상 XLSX 를 쓴다.
"""

import psycopg
import pytest

from pipeline.collect.lofin import main
from tests.test_collect_lofin import book, row
from tests_postgres.conftest import fresh_schema


@pytest.fixture
def lofin_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0015__create_local_expenditure.sql",
            "V0026__track_local_expenditure_runs.sql",
            # 마이그레이션이 미리 넣은 lofin 출처 행과 수집기 값이 맞아야 다시 받아도 멈추지 않는다
            "V0039__fill_source_reliability_grade.sql",
            "V0040__add_lofin_source.sql",
        ),
    )


def latest(conn):
    return conn.execute(
        "SELECT fiscal_year, project_name, expenditure FROM local_expenditure_latest ORDER BY 1, 2"
    ).fetchall()


def test_store_then_rerun_adds_nothing(lofin_db, tmp_path, capsys):
    conn, connect = lofin_db
    path = book(
        tmp_path / "2024.xlsx",
        [row("광주", "북구", "청년 일자리"), row("전남", "여수시", "대기 측정")],
        year="2024",
    )
    assert main(["--xlsx", str(path), "--db"], connect=connect) == 0
    assert '"inserted": 2' in capsys.readouterr().out
    # 서버 실행기처럼 --output 을 붙이면 저장하고 사본도 남긴다
    copy = tmp_path / "c1.json"
    assert main(["--xlsx", str(path), "--db", "--output", str(copy)], connect=connect) == 0
    assert '"duplicates": 2' in capsys.readouterr().out
    assert len(copy.read_bytes().splitlines()) == 2
    rows = conn.execute(
        "SELECT place_code_raw, fiscal_year, project_name, budget_total, storage_scope"
        " FROM local_expenditure ORDER BY place_code_raw"
    ).fetchall()
    assert rows == [
        ("29170", 2024, "청년 일자리", 1000, "full"),
        ("46130", 2024, "대기 측정", 1000, "full"),
    ]
    assert conn.execute("SELECT source_id, storage_scope FROM source").fetchall() == [
        ("lofin", "full")
    ]
    assert conn.execute("SELECT spec_id, evidence_class FROM source_spec").fetchall() == [
        ("lofin_expenditure_gwangju_yeosu", "existing_responses")
    ]
    runs = conn.execute(
        "SELECT status, stats->>'fiscal_year', stats->>'inserted' FROM job_run ORDER BY started_at"
    ).fetchall()
    assert runs == [("ok", "2024", "2"), ("ok", "2024", "0")]


def test_changed_amounts_leave_one_latest_row_per_project(lofin_db, tmp_path):
    conn, connect = lofin_db
    first = book(
        tmp_path / "a.xlsx",
        [row("광주", "북구", "청년 일자리", spent=500), row("전남", "여수시", "대기 측정")],
        year="2025",
    )
    other_year = book(tmp_path / "b.xlsx", [row("광주", "북구", "청년 일자리")], year="2024")
    assert main(["--xlsx", str(first), "--db"], connect=connect) == 0
    assert main(["--xlsx", str(other_year), "--db"], connect=connect) == 0
    # 2025 파일을 다시 받았더니 청년 일자리 지출이 늘었다 → 새 행, 옛 행은 표에 남는다
    again = book(
        tmp_path / "c.xlsx",
        [row("광주", "북구", "청년 일자리", spent=900), row("전남", "여수시", "대기 측정")],
        year="2025",
    )
    assert main(["--xlsx", str(again), "--db"], connect=connect) == 0

    assert conn.execute("SELECT count(*) FROM local_expenditure").fetchone() == (4,)
    assert latest(conn) == [
        (2024, "청년 일자리", 900),
        (2025, "대기 측정", 900),
        (2025, "청년 일자리", 900),
    ]


def test_rows_before_run_tracking_stay_latest_until_the_year_is_reloaded(lofin_db, tmp_path):
    conn, connect = lofin_db
    conn.execute(
        "INSERT INTO local_expenditure VALUES ('sha256:' || repeat('a', 64), 2024,"
        " '광주', '북구', '29170', '일반회계', '옛 사업', 1, 0, 0, 1, 0, 1, 0, null, null,"
        " 'f.xlsx', 'L', 'full', now(), 'test')"
    )
    assert latest(conn) == [(2024, "옛 사업", 1)]
    path = book(tmp_path / "2024.xlsx", [row("광주", "북구", "청년 일자리")], year="2024")
    assert main(["--xlsx", str(path), "--db"], connect=connect) == 0
    assert latest(conn) == [(2024, "청년 일자리", 900)]


def test_table_rejects_other_storage_scope(lofin_db):
    conn, _ = lofin_db
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO local_expenditure VALUES ('sha256:' || repeat('a', 64), 2024,"
            " '광주', '북구', '29170', '일반회계', 'x', 1, 0, 0, 1, 0, 1, 0, null, null,"
            " 'f.xlsx', 'L', 'metadata', now(), 'test')"
        )
