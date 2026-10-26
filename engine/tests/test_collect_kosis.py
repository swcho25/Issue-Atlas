"""실제 C1 원천 예시와 실패 응답으로 수집 경계를 확인한다. 네트워크·키 필요 없음."""

import copy
import json
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest

from pipeline.collect import kosis
from pipeline.collect.__main__ import main
from pipeline.collect.kosis import CollectionError, Query, to_records
from pipeline.collect.run import collect
from pipeline.refine.run import refine_records

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "contracts/c1/examples/raw/kosis-net-migration.json"
ROWS = json.loads(FIXTURE.read_text(encoding="utf-8"))
QUERY = Query("net_migration_test", regions=("46130",))
AT = "2026-10-23T00:00:00+00:00"


class MemoryStore:
    def __init__(self):
        self.raw = {}
        self.runs = {}

    def start(self, query, run_id, started_at):
        self.runs[run_id] = {"status": None}

    def save(self, rows, records):
        inserted = 0
        for row, record in zip(rows, records, strict=True):
            if record["content_hash"] not in self.raw:
                self.raw[record["content_hash"]] = copy.deepcopy(row)
                inserted += 1
        return inserted

    def finish(self, run_id, status, stats):
        self.runs[run_id] = {"status": status, **stats}


def source(query, region, api_key):
    return copy.deepcopy(ROWS)


def test_actual_fixture_values_period_hash_and_p2():
    records = to_records(ROWS, QUERY, "test-run", AT)
    assert [r["value"] for r in records] == [-747, -719, -930]
    assert records[0]["observed_period_start"] == "2023-01-01T00:00:00+09:00"
    assert records[-1]["observed_period_end"] == "2026-01-01T00:00:00+09:00"
    assert records[0]["place_code_raw"] == "46130"
    assert all(r["validation_status"] == "pass" for r in refine_records(records))
    again = to_records(ROWS, QUERY, "another-run", "2026-10-24T00:00:00+00:00")
    assert [r["content_hash"] for r in again] == [r["content_hash"] for r in records]
    changed = copy.deepcopy(ROWS)
    changed[0]["DT"] = "-748"
    assert to_records(changed, QUERY, "test", AT)[0]["content_hash"] != records[0]["content_hash"]


@pytest.mark.parametrize("value", ["", " "])
def test_missing_value_stays_missing(value):
    rows = copy.deepcopy(ROWS)
    rows[0]["DT"] = value
    record = to_records(rows, QUERY, "test", AT)[0]
    assert record["value"] is None
    assert record["missing_reason"] == "not_published"
    assert refine_records([record])[0]["validation_status"] == "pass"


@pytest.mark.parametrize(
    "field,value",
    [
        ("DT", "NaN"),
        ("DT", "Infinity"),
        ("DT", "1.5"),
        ("DT", "oops"),
        ("DT", "7,4,7"),
        ("DT", "-"),
        ("DT", "..."),
        ("PRD_SE", "M"),
        ("C1", "12130"),
        ("C2", "1"),
        ("C3", "000"),
        ("ITM_ID", "T20"),
        ("ORG_ID", "999"),
        ("TBL_ID", "other"),
        ("PRD_DE", "2026"),
        ("LST_CHN_DE", "invalid"),
        ("UNIT_NM", "%"),
    ],
)
def test_bad_rows_are_rejected(field, value):
    rows = copy.deepcopy(ROWS)
    rows[0][field] = value
    with pytest.raises(CollectionError, match="KOSIS_INVALID_ROW"):
        to_records(rows, QUERY, "test", AT)


def test_partial_and_duplicate_response_rejected():
    with pytest.raises(CollectionError, match="INCOMPLETE"):
        to_records(ROWS[:1], QUERY, "test", AT)
    with pytest.raises(CollectionError, match="INVALID_ROW"):
        to_records(ROWS + ROWS[:1], QUERY, "test", AT)


@pytest.mark.parametrize("value,expected", [("0", 0), ("1,234", 1234), ("-1,234", -1234)])
def test_zero_and_signed_grouped_numbers(value, expected):
    rows = copy.deepcopy(ROWS)
    rows[0]["DT"] = value
    record = to_records(rows, QUERY, "test", AT)[0]
    assert record["value"] == expected and record["missing_reason"] is None


def test_six_regions_are_requested_and_validated_separately(tmp_path):
    query = Query("net_migration_test")
    requested = []

    def synthetic_fetch(query, region, api_key):
        requested.append(region)
        rows = copy.deepcopy(ROWS)
        for row in rows:
            row["C1"] = region
        return rows

    store = MemoryStore()
    result = collect(query, "fixture", store, tmp_path / "out.json", fetch=synthetic_fetch)
    assert requested == list(kosis.REGIONS)
    assert result["received"] == 18 and result["inserted"] == 18


class UnlistedLicense(Query):
    license_type = "KOGL-unlisted"


def test_records_take_license_from_query():
    # source 표와 레코드의 이용 조건이 한 곳(Query)에서 나온다
    records = to_records(ROWS, UnlistedLicense("net_migration_test", regions=("46130",)), "t", AT)
    assert {r["license_type"] for r in records} == {"KOGL-unlisted"}


def test_later_region_failure_does_not_persist_earlier_region(tmp_path):
    # 여수 응답이 정상이어도 광주 요청이 잘못되면 부분 적재하지 않는다.
    store = MemoryStore()
    with pytest.raises(CollectionError, match="INVALID_ROW"):
        collect(Query("net_migration_test"), "fixture", store, tmp_path / "out", fetch=source)
    assert not store.raw
    assert next(iter(store.runs.values()))["status"] == "failed"


def test_success_repeat_and_c1_cli_handoff(tmp_path):
    store = MemoryStore()
    output = tmp_path / "c1.json"
    first = collect(QUERY, "secret-not-printed", store, output, fetch=source)
    second = collect(QUERY, "secret-not-printed", store, output, fetch=source)
    assert first["inserted"] == 3
    assert second["inserted"] == 0 and second["duplicates"] == 3
    assert len(store.runs) == 2 and len(store.raw) == 3
    result = subprocess.run(
        [sys.executable, "-m", "pipeline.refine", str(output)],
        cwd=ROOT / "engine",
        capture_output=True,
        check=True,
    )
    assert all(
        json.loads(line)["validation_status"] == "pass" for line in result.stdout.splitlines()
    )
    assert "secret-not-printed" not in output.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "failure,code",
    [
        (CollectionError("KOSIS_API_ERROR"), "KOSIS_API_ERROR"),
        (RuntimeError("URL?apiKey=secret"), "COLLECTION_FAILED"),
        (KeyboardInterrupt(), "COLLECTION_FAILED"),
    ],
)
def test_failure_retains_safe_run_without_raw(tmp_path, failure, code):
    def bad_fetch(*args):
        raise failure

    store = MemoryStore()
    output = tmp_path / "absent.json"
    with pytest.raises(CollectionError, match=code):
        collect(QUERY, "secret", store, output, fetch=bad_fetch)
    assert not output.exists() and not store.raw
    run = next(iter(store.runs.values()))
    assert run["status"] == ("aborted" if isinstance(failure, KeyboardInterrupt) else "failed")
    assert "secret" not in json.dumps(run)


def test_missing_key_still_records_failed_run(tmp_path):
    store = MemoryStore()
    with pytest.raises(CollectionError, match="KOSIS_KEY_MISSING"):
        collect(QUERY, "", store, tmp_path / "out", fetch=source)
    assert next(iter(store.runs.values()))["error_code"] == "KOSIS_KEY_MISSING"


def test_export_only_does_not_load_env_or_connect(tmp_path, monkeypatch, capsys):
    import pipeline.collect.__main__ as cli

    def forbidden(*args, **kwargs):
        pytest.fail("export-only must not read .env or use DB")

    monkeypatch.setattr(cli, "dotenv_values", forbidden)
    monkeypatch.setattr(cli.psycopg, "connect", forbidden)
    output = tmp_path / "out.json"
    assert (
        main(
            [
                "--fixture",
                str(FIXTURE),
                "--export-only",
                "--regions",
                "46130",
                "--output",
                str(output),
            ]
        )
        == 0
    )
    assert json.loads(capsys.readouterr().out) == {"mode": "export_only", "db_written": False}
    assert len(json.loads(output.read_text(encoding="utf-8"))) == 3
    records = json.loads(output.read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "contracts/c1/indicators.json").read_text(encoding="utf-8"))
    assert {r["indicator_id"] for r in records} == {catalog["indicators"][0]["indicator_id"]}


def test_network_exception_does_not_expose_key(monkeypatch):
    class BadOpener:
        def open(self, *args, **kwargs):
            raise URLError("https://kosis.kr/?apiKey=secret")

    monkeypatch.setattr(kosis, "build_opener", lambda *args: BadOpener())
    with pytest.raises(CollectionError, match="^KOSIS_NETWORK_ERROR$"):
        kosis.fetch_rows(QUERY, "46130", "secret")


@pytest.mark.parametrize(
    "body,code",
    [
        (b'{"err":"20","msg":"echo-secret"}', "SECRET_IN_RESPONSE"),
        (b'{"err":"30","msg":"no data"}', "API_ERROR"),
        (b"[]", "EMPTY_RESPONSE"),
        (b"<html>bad</html>", "INVALID_JSON"),
    ],
)
def test_api_error_json_never_becomes_success(monkeypatch, body, code):
    class Opener:
        @contextmanager
        def open(self, *args, **kwargs):
            class Response:
                def read(self, *args):
                    return body

            yield Response()

    monkeypatch.setattr(kosis, "build_opener", lambda *args: Opener())
    with pytest.raises(CollectionError, match=code):
        kosis.fetch_rows(QUERY, "46130", "echo-secret")


def test_http_error_masks_body_and_url(monkeypatch):
    class Opener:
        def open(self, *args, **kwargs):
            raise HTTPError("https://kosis.kr/?apiKey=secret", 429, "secret", {}, None)

    monkeypatch.setattr(kosis, "build_opener", lambda *args: Opener())
    with pytest.raises(CollectionError, match="^KOSIS_HTTP_429$"):
        kosis.fetch_rows(QUERY, "46130", "secret")
