"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요, 기존 DB 사용 안 함)."""

import copy
import json
import secrets
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql

from pipeline.collect.kosis import CollectionError, Query
from pipeline.collect.run import collect
from pipeline.collect.store import PostgresStore
from pipeline.refine.store import refine_raw

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT / "contracts/c1/examples/raw/kosis-net-migration.json").read_text("utf-8"))
QUERY = Query("net_migration_test", regions=("46130",))
IMAGE = (
    "postgis/postgis:17-3.5-alpine@"
    "sha256:894f570c0cf0664ed5576a8fd5d5bfb8fb1b19d592885b686c3a88c8bd90c41f"
)


@pytest.fixture(scope="module")
def database():
    name = "kosis-test-" + uuid4().hex
    password = secrets.token_urlsafe(24)
    result = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "-p",
            "127.0.0.1::5432",
            "-e",
            f"POSTGRES_PASSWORD={password}",
            IMAGE,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        pytest.fail("일회용 PostGIS 컨테이너 생성 실패. Docker Desktop 상태를 확인하세요.")
    try:
        port = (
            subprocess.run(
                ["docker", "port", name, "5432/tcp"], capture_output=True, text=True, check=True
            )
            .stdout.strip()
            .split(":")[-1]
        )
        deadline = time.monotonic() + 40
        while True:
            try:
                conn = psycopg.connect(
                    host="127.0.0.1",
                    port=port,
                    dbname="postgres",
                    user="postgres",
                    password=password,
                    autocommit=True,
                    connect_timeout=2,
                )
                break
            except psycopg.OperationalError:
                if time.monotonic() >= deadline:
                    pytest.fail("일회용 PostGIS 시작 시간 초과")
                time.sleep(0.3)
        with conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
            yield conn
    finally:
        # 이 fixture가 만든 고유 이름의 컨테이너만 중지하며 --rm으로 제거된다.
        subprocess.run(["docker", "stop", name], capture_output=True, check=True)


@pytest.fixture
def store(database):
    schema = "test_" + uuid4().hex
    database.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    database.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(schema)))
    migrations = ROOT / "backend/src/main/resources/db/migration"
    for name in (
        "V0002__collection_place_foundation.sql",
        "V0005__create_normalized_record.sql",
        "V0008__create_air_monthly.sql",  # P2 정제 저장이 월별 집계를 새로 고친다
    ):
        database.execute((migrations / name).read_text("utf-8"))
    try:
        yield PostgresStore(database)
    finally:
        database.execute("SET search_path TO public")
        database.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def fetch(*args):
    return copy.deepcopy(ROWS)


def test_real_database_repeat_and_revision(store, tmp_path):
    output = tmp_path / "c1.json"
    first = collect(QUERY, "fixture", store, output, fetch=fetch)
    second = collect(QUERY, "fixture", store, output, fetch=fetch)
    assert first["inserted"] == 3
    assert second["inserted"] == 0 and second["duplicates"] == 3
    assert store.conn.execute("SELECT count(*) FROM job_run WHERE status='ok'").fetchone() == (2,)
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (3,)
    assert store.conn.execute("SELECT payload FROM raw_record ORDER BY id").fetchall() == [
        (row,) for row in ROWS
    ]

    def revised(*args):
        rows = copy.deepcopy(ROWS)
        rows[0]["DT"] = "-748"
        rows[0]["LST_CHN_DE"] = "2026-10-23"
        return rows

    third = collect(QUERY, "fixture", store, output, fetch=revised)
    assert third["inserted"] == 1 and third["duplicates"] == 2
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (4,)
    assert store.conn.execute("SELECT count(*) FROM source").fetchone() == (1,)
    assert store.conn.execute("SELECT count(*) FROM source_spec").fetchone() == (1,)


def test_raw_rows_carry_c1_ledger_that_p2_refines(store, tmp_path):
    collect(QUERY, "fixture", store, tmp_path / "c1.json", fetch=fetch)
    rows = store.conn.execute(
        "SELECT c1_record->>'content_hash' = content_hash, c1_record->>'run_id' = job_run_id "
        "FROM raw_record"
    ).fetchall()
    assert rows == [(True, True)] * 3
    result = refine_raw(store.conn)
    assert result["inserted"] == 3 and result["status"] == {"pass": 3} and not result["skipped"]


def test_empty_ledger_is_backfilled_without_changing_owner(store, tmp_path):
    # V0005 전에 저장된 원본(c1_record=null)은 다시 수집할 때 장부만 채운다. 처음 장부는 덮지 않는다
    first = collect(QUERY, "fixture", store, tmp_path / "c1.json", fetch=fetch)
    store.conn.execute("UPDATE raw_record SET c1_record = NULL WHERE payload->>'PRD_DE' = '2023'")
    again = collect(QUERY, "fixture", store, tmp_path / "c1.json", fetch=fetch)
    assert again["inserted"] == 0 and again["duplicates"] == 3
    owners = store.conn.execute(
        "SELECT DISTINCT job_run_id, c1_record->>'run_id' FROM raw_record"
    ).fetchall()
    filled = store.conn.execute(
        "SELECT c1_record->>'run_id' FROM raw_record WHERE payload->>'PRD_DE' = '2023'"
    ).fetchone()
    assert {o[0] for o in owners} == {first["run_id"]}
    assert filled == (again["run_id"],)
    assert store.conn.execute(
        "SELECT count(*) FROM raw_record WHERE c1_record->>'run_id' = %s", (first["run_id"],)
    ).fetchone() == (2,)


def test_mid_batch_database_error_rolls_back_raw_but_keeps_failed_job(store, tmp_path):
    # 1건은 INSERT되고 두 번째에서 DB CHECK 위반: 배치 전체 롤백을 확인한다.
    store.conn.execute("ALTER TABLE raw_record ADD CHECK (payload->>'PRD_DE' <> '2024')")
    with pytest.raises(CollectionError, match="DB_WRITE_FAILED"):
        collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=fetch)
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (0,)
    status, stats, finished = store.conn.execute(
        "SELECT status, stats, finished_at IS NOT NULL FROM job_run"
    ).fetchone()
    assert status == "failed" and stats["error_code"] == "DB_WRITE_FAILED" and finished


def test_partial_api_failure_and_key_missing_record_failure(store, tmp_path):
    def incomplete(*args):
        return copy.deepcopy(ROWS[:1])

    with pytest.raises(CollectionError, match="INCOMPLETE_RESPONSE"):
        collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=incomplete)
    with pytest.raises(CollectionError, match="KEY_MISSING"):
        collect(QUERY, "", store, tmp_path / "out.json", fetch=fetch)
    assert store.conn.execute("SELECT count(*) FROM job_run WHERE status='failed'").fetchone() == (
        2,
    )
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (0,)


def test_existing_source_policy_is_never_overwritten(store, tmp_path):
    collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=fetch)
    store.conn.execute("UPDATE source SET storage_scope='metadata'")
    with pytest.raises(CollectionError, match="SOURCE_CONTRACT_MISMATCH"):
        collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=fetch)
    assert store.conn.execute("SELECT storage_scope FROM source").fetchone() == ("metadata",)


def test_spec_cannot_be_reused_for_different_period(store, tmp_path):
    collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=fetch)
    other = Query("net_migration_test", start=2024, regions=("46130",))
    with pytest.raises(CollectionError, match="SPEC_CONTRACT_MISMATCH"):
        collect(other, "fixture", store, tmp_path / "out.json", fetch=fetch)
    assert store.conn.execute("SELECT count(*) FROM job_run").fetchone() == (1,)


def test_export_failure_is_recorded_with_saved_count(store, tmp_path):
    # DB 저장 후 파일 쓰기 실패는 raw를 보존하고 failed 기록을 남긴다. 재시도는 dedup한다.
    absent = tmp_path / "missing-parent" / "out.json"
    with pytest.raises(CollectionError, match="C1_EXPORT_FAILED"):
        collect(QUERY, "fixture", store, absent, fetch=fetch)
    assert store.conn.execute("SELECT count(*) FROM raw_record").fetchone() == (3,)
    status, stats = store.conn.execute("SELECT status, stats FROM job_run").fetchone()
    assert status == "failed" and stats["inserted"] == 3
    again = collect(QUERY, "fixture", store, tmp_path / "out.json", fetch=fetch)
    assert again["inserted"] == 0 and again["duplicates"] == 3
