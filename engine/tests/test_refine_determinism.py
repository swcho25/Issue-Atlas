import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline.refine.serialize import dumps_record
from tests.samples import FIXTURES

ENGINE_DIR = Path(__file__).parent.parent


def run_cli(input_path, hash_seed):
    env = {**os.environ, "PYTHONHASHSEED": hash_seed}
    return subprocess.run(
        [sys.executable, "-m", "pipeline.refine", str(input_path)],
        cwd=ENGINE_DIR,
        env=env,
        capture_output=True,
        check=True,
    ).stdout


@pytest.mark.parametrize("name", ["kosis_net_migration.json", "airkorea_final_pm25.json"])
def test_same_input_gives_same_bytes_in_separate_runs(name):
    # 해시 시드가 달라도(= 다른 프로세스) 결과가 같아야 한다 (KPI 재현성 100%)
    first = run_cli(FIXTURES / name, "1")
    second = run_cli(FIXTURES / name, "2")

    assert first == second
    assert len(first.splitlines()) == 3


def test_cli_writes_one_refined_record_per_line_with_lf():
    out = run_cli(FIXTURES / "airkorea_final_pm25.json", "0")

    assert b"\r" not in out
    lines = [json.loads(line) for line in out.decode("utf-8").splitlines()]
    assert [r["dedup_key"] for r in lines] == [
        "airkorea_final:336121:PM25:2024010101",
        "airkorea_final:336121:PM25:2024010102",
        "airkorea_final:336121:PM25:2024010124",
    ]
    assert {r["validation_status"] for r in lines} == {"held"}


def test_record_serializes_to_sorted_compact_utf8_json():
    record = {"b": 1, "a": "여수", "c": {"z": 0.1, "y": None}}

    assert dumps_record(record) == '{"a":"여수","b":1,"c":{"y":null,"z":0.1}}'
