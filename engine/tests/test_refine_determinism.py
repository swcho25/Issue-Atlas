import json
import os
import subprocess
import sys
from pathlib import Path

from pipeline.refine.serialize import dumps_record
from tests.samples import AIRKOREA, P1_SAMPLES

ENGINE_DIR = Path(__file__).parent.parent


def write_input(tmp_path, records):
    path = tmp_path / "records.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    return path


def run_cli(input_path, hash_seed):
    env = {**os.environ, "PYTHONHASHSEED": hash_seed}
    return subprocess.run(
        [sys.executable, "-m", "pipeline.refine", str(input_path)],
        cwd=ENGINE_DIR,
        env=env,
        capture_output=True,
        check=True,
    ).stdout


def test_same_input_gives_same_bytes_in_separate_runs(tmp_path):
    # 해시 시드가 달라도(= 다른 프로세스) 결과가 같아야 한다 (KPI 재현성 100%)
    path = write_input(tmp_path, P1_SAMPLES)

    first = run_cli(path, "1")
    second = run_cli(path, "2")

    assert first == second
    assert len(first.splitlines()) == 5


def test_cli_writes_one_refined_record_per_line_with_lf(tmp_path):
    out = run_cli(write_input(tmp_path, AIRKOREA), "0")

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
