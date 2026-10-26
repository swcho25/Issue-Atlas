"""정제 저장 테스트용 일회용 PostGIS. 기존 DB 는 쓰지 않는다 (Docker 필요)."""

import secrets
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "backend/src/main/resources/db/migration"
IMAGE = (
    "postgis/postgis:17-3.5-alpine@"
    "sha256:894f570c0cf0664ed5576a8fd5d5bfb8fb1b19d592885b686c3a88c8bd90c41f"
)


@pytest.fixture(scope="module")
def postgis():
    """컨테이너 하나를 띄우고 접속 함수를 돌려준다. 끝나면 이 이름의 컨테이너만 멈춘다(--rm)."""
    name = "refine-test-" + uuid4().hex
    password = secrets.token_urlsafe(24)
    result = subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::5432"]
        + ["-e", f"POSTGRES_PASSWORD={password}", IMAGE],
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

        def connect(**options):
            return psycopg.connect(
                host="127.0.0.1",
                port=port,
                dbname="postgres",
                user="postgres",
                password=password,
                autocommit=True,
                connect_timeout=2,
                **options,
            )

        deadline = time.monotonic() + 40
        while True:
            try:
                with connect() as conn:
                    conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
                break
            except psycopg.OperationalError:
                if time.monotonic() >= deadline:
                    pytest.fail("일회용 PostGIS 시작 시간 초과")
                time.sleep(0.3)
        yield connect
    finally:
        subprocess.run(["docker", "stop", name], capture_output=True, check=True)


@pytest.fixture
def refine_db(postgis):
    """테스트마다 새 스키마에 V0002(수집·지역) · V0005(정제) 를 적용한다.

    (연결, 같은 스키마로 새 연결을 여는 함수) 를 돌려준다.
    """
    schema = "test_" + uuid4().hex
    with postgis() as admin:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))

    def connect():
        return postgis(options=f"-c search_path={schema},public")

    conn = connect()
    try:
        for name in (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
        ):
            conn.execute((MIGRATIONS / name).read_text("utf-8"))
        yield conn, connect
    finally:
        conn.close()
        with postgis() as admin:
            admin.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))
