"""KOSIS와 같은 V0002 저장 경로로 file/api 실행·원천·중복·롤백을 확인한다."""

import pytest

from pipeline.collect.airkorea import AirSpec, measurement_pairs, station_record
from pipeline.collect.airkorea_cli import execute
from pipeline.collect.kosis import CollectionError
from tests.test_collect_airkorea import FINAL, ROWS, STATIONS, gwangju_station
from tests_postgres.test_collect_store import database as database
from tests_postgres.test_collect_store import store as store


def source(spec, run, at):
    for number, row in enumerate(ROWS, start=2):
        yield from measurement_pairs(row, "2024년 1월 ", number, spec, run, at)


def test_file_insert_repeat_raw_trace_and_p2_contract(store, tmp_path):
    first = execute(FINAL, store, tmp_path / "c1.json", source)
    again = execute(FINAL, store, tmp_path / "c1.json", source)
    assert first["inserted"] == 18 and again["inserted"] == 0 and again["duplicates"] == 18
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (18,)
    assert store.conn.execute("SELECT method FROM source_spec").fetchone() == ("file",)
    assert store.conn.execute(
        "SELECT count(*) FROM raw_record WHERE file_name IS NOT NULL AND raw_url IS NULL"
    ).fetchone() == (18,)
    payload = store.conn.execute("SELECT payload FROM raw_record ORDER BY id LIMIT 1").fetchone()[0]
    assert payload["cells"] == ROWS[0] and payload["column"] == "아황산가스(SO2)"


def test_file_database_error_rolls_back_all_measurements(store, tmp_path):
    store.conn.execute(
        "ALTER TABLE raw_record ADD CHECK (payload->>'column' <> '초미세먼지(PM25)')"
    )
    with pytest.raises(CollectionError, match="DB_WRITE_FAILED"):
        execute(FINAL, store, tmp_path / "out", source)
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (0,)
    status, stats = store.conn.execute("SELECT status, stats FROM job_run").fetchone()
    assert status == "failed" and stats["error_code"] == "DB_WRITE_FAILED"


def test_station_and_final_use_distinct_source_spec_and_correct_license(store, tmp_path):
    spec = AirSpec("stations")

    def loader(spec, run, at):
        for item in (STATIONS[1], gwangju_station()):
            yield (
                item,
                station_record(item, spec, run, at, "https://apis.data.go.kr/?serviceKey=<KEY>"),
            )

    execute(spec, store, tmp_path / "stations.json", loader)
    execute(FINAL, store, tmp_path / "final.json", source)
    assert store.conn.execute(
        "SELECT count(*) FROM source WHERE license_type='KOGL-3'"
    ).fetchone() == (2,)
    assert store.conn.execute("SELECT count(*) FROM job_run WHERE status='ok'").fetchone() == (2,)
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (20,)


def test_missing_api_key_is_failed_job(store, tmp_path):
    from pipeline.collect.airkorea import station_pairs

    def loader(spec, run, at):
        return station_pairs(spec, run, at, "")

    with pytest.raises(CollectionError, match="KEY_MISSING"):
        execute(AirSpec("stations"), store, tmp_path / "out", loader)
    assert store.conn.execute("SELECT status FROM job_run").fetchone() == ("failed",)
