"""실제 C1 원천 예시와 실패 응답으로 수집 경계를 확인한다. 네트워크·키 필요 없음."""

import copy
import itertools
import json
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest

from pipeline.collect import kosis
from pipeline.collect.__main__ import main
from pipeline.collect.kosis import TABLES, CollectionError, Query, to_records
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


def synthetic(query, region, api_key=None):
    """표 정의대로 모든 분류·기간 조합의 원천 행을 만든다(실제 응답 키 형식)."""
    t = query.table
    rows = []
    for codes in itertools.product(*t.dims):
        for prd in query.periods():
            row = {"ORG_ID": "101", "TBL_ID": t.tbl_id, "ITM_ID": t.item_id, "UNIT_NM": "명"}
            row |= {"C1": region, "PRD_DE": prd, "DT": "-12", "LST_CHN_DE": "2026-10-14"}
            row |= {f"C{i}": c for i, c in enumerate(codes, 2)}
            rows.append(row | {"PRD_SE": "A" if t.prd_se == "Y" else "M"})
    return rows


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
    fixture = tmp_path / "sp01.json"
    sp01 = Query(regions=("46130",), table=TABLES["SP01"])
    fixture.write_text(json.dumps(synthetic(sp01, "46130")), encoding="utf-8")
    argv = ["--fixture", str(fixture), "--export-only", "--regions", "46130"]
    assert main([*argv, "--output", str(output)]) == 0
    assert json.loads(capsys.readouterr().out) == {"mode": "export_only", "db_written": False}
    assert len(json.loads(output.read_text(encoding="utf-8"))) == 3 * 36
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


@pytest.mark.parametrize(
    "spec,count,first,last",
    [
        ("SP01", 3 * 36, ("2023-01-01", "2023-02-01"), ("2025-12-01", "2026-01-01")),
        ("SP02", 18 * 36, ("2023-01-01", "2023-02-01"), ("2025-12-01", "2026-01-01")),
        ("SP10", 22 * 3, ("2023-01-01", "2024-01-01"), ("2025-01-01", "2026-01-01")),
    ],
)
def test_card_c1_tables_cover_every_code_and_pass_p2(spec, count, first, last):
    table = TABLES[spec]
    query = Query(table.indicator_id, regions=("46130",), spec_id=spec, table=table)
    records = to_records(synthetic(query, "46130"), query, "t", AT)
    assert len(records) == count
    bounds = [(r["observed_period_start"][:10], r["observed_period_end"][:10]) for r in records]
    assert first in bounds and last in bounds
    assert {r["observed_period_type"] for r in records} == {table.prd_se}
    assert len({r["dedup_key"] for r in records}) == count
    assert all(r["validation_status"] == "pass" for r in refine_records(records))
    with pytest.raises(CollectionError, match="INCOMPLETE"):
        to_records(synthetic(query, "46130")[1:], query, "t", AT)


def test_flow_locator_keeps_destination_and_rejects_unrequested_codes():
    query = Query("population_movers", regions=("46130",), spec_id="SP02", table=TABLES["SP02"])
    rows = synthetic(query, "46130")
    record = to_records(rows, query, "t", AT)[0]
    assert record["place_code_raw"] == "46130"
    assert record["locator"] == {
        "tbl_id": "DT_1B26003_A02",
        "C1": "46130",
        "C2": "00",
        "C3": "0",
        "itm_id": "T70",
        "prd_de": "202301",
    }
    for field, value in [("C2", "12"), ("C4", "0"), ("PRD_SE", "A"), ("PRD_DE", "202313")]:
        bad = copy.deepcopy(rows)
        bad[0][field] = value
        with pytest.raises(CollectionError, match="KOSIS_INVALID_ROW"):
            to_records(bad, query, "t", AT)


def test_spec_identity_is_table_only_and_run_params_carry_period():
    sp01 = TABLES["SP01"]
    a = Query(regions=("46130",), table=sp01)
    b = Query(start=2012, end=2024, table=sp01)
    assert a.identity() == b.identity()
    assert a.identity() != Query(table=TABLES["SP10"]).identity()
    assert b.run_params() == {"start": 2012, "end": 2024, "regions": list(kosis.REGIONS)}
    params = a.params("46130")
    assert (params["objL3"], params["startPrdDe"], params["endPrdDe"]) == (
        "000+901+905",
        "202301",
        "202512",
    )


def test_ci_smoke_fixture_matches_current_sp01(tmp_path, capsys):
    # 수집기 이미지 CI 점검(.gitlab/ci/deploy.gitlab-ci.yml)과 같은 인자. 기본 표가 바뀌면 여기서 먼저 깨진다
    fixture = ROOT / "contracts/c1/examples/raw/kosis-sp01-monthly.json"
    ci = (ROOT / ".gitlab/ci/deploy.gitlab-ci.yml").read_text(encoding="utf-8")
    argv = ["--export-only", "--regions", "46130", "--start-year", "2023", "--end-year", "2023"]
    assert "kosis-sp01-monthly.json " + " ".join(argv) in ci
    output = tmp_path / "c1.json"
    assert main(["--fixture", str(fixture), *argv, "--output", str(output)]) == 0
    records = json.loads(output.read_text(encoding="utf-8"))
    assert len(records) == 36
    assert all(r["validation_status"] == "pass" for r in refine_records(records))
