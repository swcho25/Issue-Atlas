"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

세부사업별 세출현황을 local_expenditure(V0015)에 저장한다. 가상 XLSX 를 쓴다.
"""

import psycopg
import pytest

from pipeline.collect.lofin import main
from tests.test_collect_lofin import book, row
from tests_postgres.conftest import fresh_schema


@pytest.fixture
def lofin_db(postgis):
    yield from fresh_schema(postgis, ("V0015__create_local_expenditure.sql",))


def test_store_then_rerun_adds_nothing(lofin_db, tmp_path, capsys):
    conn, connect = lofin_db
    path = book(
        tmp_path / "2024.xlsx",
        [row("광주", "북구", "청년 일자리"), row("전남", "여수시", "대기 측정")],
        year="2024",
    )
    assert main(["--xlsx", str(path), "--db"], connect=connect) == 0
    assert '"inserted": 2' in capsys.readouterr().out
    assert main(["--xlsx", str(path), "--db"], connect=connect) == 0
    assert '"duplicates": 2' in capsys.readouterr().out
    rows = conn.execute(
        "SELECT place_code_raw, fiscal_year, project_name, budget_total, storage_scope"
        " FROM local_expenditure ORDER BY place_code_raw"
    ).fetchall()
    assert rows == [
        ("29170", 2024, "청년 일자리", 1000, "full"),
        ("46130", 2024, "대기 측정", 1000, "full"),
    ]


def test_table_rejects_other_storage_scope(lofin_db):
    conn, _ = lofin_db
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO local_expenditure VALUES ('sha256:' || repeat('a', 64), 2024,"
            " '광주', '북구', '29170', '일반회계', 'x', 1, 0, 0, 1, 0, 1, 0, null, null,"
            " 'f.xlsx', 'L', 'metadata', now(), 'test')"
        )
