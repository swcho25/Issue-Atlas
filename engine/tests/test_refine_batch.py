import copy
import re

import pytest

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


def kosis_2023_recollected():
    # 다음 날 다시 받았는데 KOSIS 가 고치지 않아 값·수정일(dedup_key)이 그대로인 것
    return {
        **kosis_2023(),
        "collected_at": "2026-10-22T11:00:00+09:00",
        "run_id": "run_20261022_001",
        "collector_version": "0.1.1",
    }


def kosis_2024():
    record = kosis_2023()
    record["locator"]["prd_de"] = "2024"
    record["dedup_key"] = "kosis:DT_1B26001:46130:0:120:T25:Y:2024:2026-10-14"
    return record


def station():
    # 계약 예시의 이용허락은 TBD 라, 측정소 수집기가 쓰는 KOGL-3 으로
    return {**copy.deepcopy(STATION[0]), "content_hash": HASH, "license_type": "KOGL-3"}


def issue(code, field):
    return {"code": code, "field": field}


def test_same_source_cell_gets_same_obs_key_across_revisions():
    old, new, other = (refine_record(r) for r in (kosis_2023(), kosis_2023_revised(), kosis_2024()))

    assert re.fullmatch(r"obs:[0-9a-f]{64}", old["obs_key"])
    assert old["obs_key"] == new["obs_key"]
    assert old["obs_key"] != other["obs_key"]


def test_station_meta_record_is_its_own_cell_and_latest():
    out = refine_records([station()])

    assert re.fullmatch(r"obs:[0-9a-f]{64}", out[0]["obs_key"])
    assert out[0]["is_latest"] is True


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


def test_same_object_twice_is_output_once():
    record = kosis_2023()

    assert len(refine_records([record, record])) == 1


def test_same_dedup_key_with_different_content_is_held():
    conflicting = {**kosis_2023(), "value": -1}

    out = refine_records([kosis_2023(), conflicting])

    assert [r["value"] for r in out] == [-747, -1]
    for r in out:
        assert r["validation_status"] == "held"
        assert r["issues"] == [issue("DEDUP_KEY_CONFLICT", "dedup_key")]
        assert r["is_latest"] is False


def test_recollected_same_content_is_output_once_as_last_checked():
    out = refine_records([kosis_2023(), kosis_2023_recollected()])

    assert len(out) == 1
    assert out[0]["validation_status"] == "pass"
    assert out[0]["is_latest"] is True
    assert (out[0]["collected_at"], out[0]["run_id"], out[0]["collector_version"]) == (
        "2026-10-22T11:00:00+09:00",
        "run_20261022_001",
        "0.1.1",
    )


def test_recollected_choice_does_not_depend_on_input_order():
    forward = refine_records([kosis_2023(), kosis_2023_recollected()])
    backward = refine_records([kosis_2023_recollected(), kosis_2023()])

    assert forward == backward


def test_same_collected_at_keeps_larger_run_id():
    first = {**kosis_2023(), "run_id": "run_20261021_001"}
    second = {**kosis_2023(), "run_id": "run_20261021_002"}

    for records in ([first, second], [second, first]):
        out = refine_records(records)
        assert [(r["run_id"], r["validation_status"]) for r in out] == [
            ("run_20261021_002", "pass")
        ]


@pytest.mark.parametrize("broken", ["어제", "2026-10-30T11:00:00", None])
def test_recollected_with_unreadable_collected_at_loses_to_valid_one(broken):
    # 검증 전에 고르므로 시각이 틀린 레코드가 와도 멈추지 않고, 읽을 수 있는 쪽을 남긴다
    bad = {**kosis_2023_recollected(), "collected_at": broken}

    for records in ([kosis_2023(), bad], [bad, kosis_2023()]):
        out = refine_records(records)
        assert [(r["collected_at"], r["validation_status"]) for r in out] == [
            ("2026-10-21T11:00:00+09:00", "pass")
        ]


@pytest.mark.parametrize(
    "change",
    [
        {"value": -1},
        {"value": None, "missing_reason": "not_collected"},
    ],
    ids=["value", "missing_reason"],
)
def test_recollected_with_other_field_changed_is_still_conflict(change):
    changed = {**kosis_2023_recollected(), **change}

    out = refine_records([kosis_2023(), changed])

    assert len(out) == 2
    for r in out:
        assert r["validation_status"] == "held"
        assert r["issues"] == [issue("DEDUP_KEY_CONFLICT", "dedup_key")]
        assert r["is_latest"] is False


def test_copy_with_only_content_hash_changed_is_same_version():
    # 원천의 장부 밖 칸(KOSIS 이름표 등)만 바뀌어 원본이 새로 생긴 재수집. 장부 내용은 같다
    copied = {**kosis_2023_recollected(), "content_hash": HASH2}

    for records in ([kosis_2023(), copied], [copied, kosis_2023()]):
        out = refine_records(records)
        assert [(r["validation_status"], r["issues"]) for r in out] == [("pass", [])] * 2
        # 원본 한 행 = 정제 한 행이라 둘 다 남고, 늦게 받은 사본만 최신
        latest = {r["content_hash"]: r["is_latest"] for r in out}
        assert latest == {HASH: False, HASH2: True}


def test_station_copies_leave_one_latest():
    # 측정소 응답의 장부 밖 칸(측정 항목 item 등)만 바뀐 재수집
    first = station()
    later = {**station(), "content_hash": HASH2, "collected_at": "2026-10-30T11:30:00+09:00"}

    out = refine_records([first, later])

    assert [r["validation_status"] for r in out] == ["pass", "pass"]
    assert out[0]["obs_key"] == out[1]["obs_key"]
    assert [r["is_latest"] for r in out] == [False, True]


def test_copies_with_a_conflicting_value_are_all_held():
    copied = {**kosis_2023_recollected(), "content_hash": HASH2}
    conflicting = {**kosis_2023(), "content_hash": "sha256:" + "2" * 64, "value": -1}

    out = refine_records([kosis_2023(), copied, conflicting])

    assert len(out) == 3
    for r in out:
        assert r["validation_status"] == "held"
        assert r["issues"] == [issue("DEDUP_KEY_CONFLICT", "dedup_key")]
        assert r["is_latest"] is False
