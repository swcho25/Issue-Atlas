import copy
import re

from pipeline.refine import refine_record, refine_records
from tests.samples import AIRKOREA, HASH, KOSIS, STATION

HASH2 = "sha256:" + "1" * 64


def kosis_2023():
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH}


def kosis_2023_revised():
    # 같은 통계표 칸(2023 순이동)을 KOSIS 가 11/1 에 고쳐 다시 낸 판
    return {
        **kosis_2023(),
        "content_hash": HASH2,
        "published_at": "2026-11-01T00:00:00+09:00",
        "value": -748,
        "dedup_key": "kosis:DT_1B26001:46130:0:120:T25:Y:2023:2026-11-01",
    }


def kosis_2024():
    record = kosis_2023()
    record["locator"]["prd_de"] = "2024"
    record["dedup_key"] = "kosis:DT_1B26001:46130:0:120:T25:Y:2024:2026-10-14"
    return record


def issue(code, field):
    return {"code": code, "field": field}


def test_same_source_cell_gets_same_obs_key_across_revisions():
    old, new, other = (refine_record(r) for r in (kosis_2023(), kosis_2023_revised(), kosis_2024()))

    assert re.fullmatch(r"obs:[0-9a-f]{64}", old["obs_key"])
    assert old["obs_key"] == new["obs_key"]
    assert old["obs_key"] != other["obs_key"]


def test_station_meta_record_has_no_obs_key():
    out = refine_records([{**copy.deepcopy(STATION[0]), "content_hash": HASH}])

    assert out[0]["obs_key"] is None
    assert out[0]["is_latest"] is None


def test_newest_revision_is_latest_and_old_one_is_kept():
    out = refine_records([kosis_2023(), kosis_2023_revised()])

    assert [(r["value"], r["is_latest"]) for r in out] == [(-747, False), (-748, True)]


def test_latest_does_not_depend_on_input_order():
    out = refine_records([kosis_2023_revised(), kosis_2023()])

    assert [(r["value"], r["is_latest"]) for r in out] == [(-748, True), (-747, False)]


def test_held_revision_is_never_latest():
    newest_but_held = {**kosis_2023_revised(), "content_hash": None}

    out = refine_records([kosis_2023(), newest_but_held])

    assert [(r["validation_status"], r["is_latest"]) for r in out] == [
        ("pass", True),
        ("held", False),
    ]


def test_falls_back_to_collected_at_without_published_at():
    # 에어코리아 확정 파일은 published_at 이 없다. 나중에 다시 받은 판이 최신
    first = {**copy.deepcopy(AIRKOREA[0]), "content_hash": HASH}
    again = {
        **copy.deepcopy(AIRKOREA[0]),
        "content_hash": HASH2,
        "collected_at": "2026-11-05T09:00:00+09:00",
        "value": 26,
        "dedup_key": "airkorea_final:336121:PM25:2024010101:v2",
    }

    out = refine_records([again, first])

    assert [(r["value"], r["is_latest"]) for r in out] == [(26, True), (25, False)]


def test_different_cells_are_each_latest():
    records = [{**copy.deepcopy(r), "content_hash": HASH} for r in AIRKOREA]

    out = refine_records(records)

    assert [r["is_latest"] for r in out] == [True, True, True]


def test_exact_repeat_of_same_record_is_output_once():
    out = refine_records([kosis_2023(), kosis_2023(), kosis_2024()])

    assert [r["dedup_key"] for r in out] == [
        "kosis:DT_1B26001:46130:0:120:T25:Y:2023:2026-10-14",
        "kosis:DT_1B26001:46130:0:120:T25:Y:2024:2026-10-14",
    ]


def test_same_dedup_key_with_different_content_is_held():
    conflicting = {**kosis_2023(), "value": -1}

    out = refine_records([kosis_2023(), conflicting])

    assert [r["value"] for r in out] == [-747, -1]
    for r in out:
        assert r["validation_status"] == "held"
        assert r["issues"] == [issue("DEDUP_KEY_CONFLICT", "dedup_key")]
        assert r["is_latest"] is False
