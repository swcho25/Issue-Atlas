"""원본 저장 전에는 구조·금지 출처·키만, 이용허락·범위·중복은 저장 뒤 P2가 판단한다."""

import copy
from dataclasses import replace
from datetime import date

import pytest

from pipeline.collect import run as kosis_run
from pipeline.collect.airkorea import AirSpec, measurement_pairs
from pipeline.collect.airkorea_cli import execute
from pipeline.collect.kosis import CollectionError
from pipeline.refine import refine_records
from tests.test_collect_airkorea import AT, FINAL, ROWS
from tests.test_collect_kosis import QUERY, MemoryStore, source


def pairs(spec, run, at):
    return measurement_pairs(ROWS[0], "2024년 1월 ", 2, spec, run, at)


def test_day_then_month_with_renamed_file_has_same_observation_identity():
    month = replace(FINAL, end=date(2024, 2, 1), file_name="renamed-month.xlsx")
    before = [r for _, r in pairs(FINAL, "day", AT)]
    after = [r for _, r in measurement_pairs(ROWS[0], "2024년 1월 ", 999, month, "month", AT)]
    assert FINAL.spec_id == month.spec_id and FINAL.identity() == month.identity()
    assert [r["content_hash"] for r in before] == [r["content_hash"] for r in after]
    out = refine_records(before + after)
    assert len(out) == 6
    assert all(r["validation_status"] == "pass" for r in out)
    assert all(not any(i["code"] == "DEDUP_KEY_CONFLICT" for i in r["issues"]) for r in out)
    assert FINAL.run_params() != month.run_params()


@pytest.mark.parametrize("sentinel", [-999, -999.0, "-999"])
def test_sentinel_is_missing_and_other_pollutants_survive(sentinel):
    row = copy.deepcopy(ROWS[0])
    row[-2] = sentinel
    raw, record = list(measurement_pairs(row, "2024년 1월 ", 2, FINAL, "r", AT))[-1]
    assert record["value"] is None and record["missing_reason"] == "not_published"
    assert raw["cells"][-2] == sentinel
    assert refine_records([record])[0]["validation_status"] == "pass"


def test_source_status_is_explicit_for_2025():
    with pytest.raises(CollectionError, match="DATA_STATUS_REQUIRED"):
        AirSpec("final", date(2025, 1, 1), date(2025, 1, 2), "2025.xlsx")
    row = copy.deepcopy(ROWS[0])
    row[4] = "2025010101"
    versions = []
    for status in ("provisional", "confirmed"):
        spec = AirSpec("final", date(2025, 1, 1), date(2025, 1, 2), "2025.xlsx", status)
        records = [r for _, r in measurement_pairs(row, "2025년 1월 ", 2, spec, "r", AT)]
        assert all(r["is_provisional"] == (status == "provisional") for r in records)
        versions.append(records)
    assert versions[0][0]["content_hash"] != versions[1][0]["content_hash"]
    out = refine_records(versions[0] + versions[1])
    assert all(r["validation_status"] == "pass" for r in out)
    assert len({r["obs_key"] for r in out}) == 6


def test_unknown_license_and_metadata_value_reach_storage_before_p2(tmp_path):
    def loader(spec, run, at):
        for raw, record in pairs(spec, run, at):
            yield raw, record | {"license_type": "not-in-p2-table", "storage_scope": "metadata"}

    store = MemoryStore()
    result = execute(FINAL, store, tmp_path / "c1.json", loader)
    assert result["inserted"] == 6
    assert next(iter(store.runs.values()))["file_name"] == FINAL.file_name


def test_conflicting_same_key_reaches_storage_and_p2_decides(tmp_path):
    records = []

    def loader(spec, run, at):
        for value in (25, 26):
            row = copy.deepcopy(ROWS[0])
            row[-2] = value
            raw, record = list(measurement_pairs(row, "2024년 1월 ", 2, spec, run, at))[-1]
            records.append(record)
            yield raw, record

    store = MemoryStore()
    result = execute(FINAL, store, tmp_path / "c1.json", loader)
    assert result["inserted"] == 2
    assert all(r["validation_status"] == "held" for r in refine_records(records))


@pytest.mark.parametrize(
    "changes",
    [
        {"raw_url": "https://naver.com/news"},
        {"raw_url": "https://example.org?api_key=secret"},
        {"value": "not-a-number"},
    ],
)
def test_intake_violations_fail_before_storage(tmp_path, changes):
    def loader(spec, run, at):
        for raw, record in pairs(spec, run, at):
            yield raw, record | changes

    store = MemoryStore()
    with pytest.raises(CollectionError, match="INTAKE_VALIDATION_FAILED"):
        execute(FINAL, store, tmp_path / "c1.json", loader)
    assert not store.raw
    assert next(iter(store.runs.values()))["status"] == "failed"


def test_kosis_does_not_apply_license_gate_before_storage(tmp_path, monkeypatch):
    original = kosis_run.to_records

    def records(*args, **kwargs):
        return [r | {"license_type": "not-in-p2-table"} for r in original(*args, **kwargs)]

    monkeypatch.setattr(kosis_run, "to_records", records)
    store = MemoryStore()
    assert kosis_run.collect(QUERY, "mock", store, tmp_path / "out", fetch=source)["inserted"] == 3
