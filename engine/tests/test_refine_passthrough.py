import copy

import pytest

from pipeline.refine import refine_record
from tests.samples import AIRKOREA, HASH, P1_SAMPLES, SAMPLE_IDS

# P1 이 수집 단계에서 채우는 시간·공간 칸. P2 는 손대지 않는다 (P3 몫)
P1_TIME_PLACE_FIELDS = [
    "published_at",
    "observed_at",
    "observed_at_source",
    "observed_period_type",
    "observed_period_start",
    "observed_period_end",
    "geometry",
    "location_precision",
    "geometry_role",
]


@pytest.mark.parametrize("content_hash", [None, HASH], ids=["held", "pass"])
@pytest.mark.parametrize("record", P1_SAMPLES, ids=SAMPLE_IDS)
def test_p1_time_and_place_fields_come_out_unchanged(record, content_hash):
    before = {**copy.deepcopy(record), "content_hash": content_hash}

    out = refine_record(copy.deepcopy(before))

    for field in P1_TIME_PLACE_FIELDS:
        assert (field in out) == (field in before), field
        assert out.get(field) == before.get(field), field


def test_hour_24_record_keeps_p1_time_and_coordinates():
    # 측정일시 2024010124 → P1 이 다음 날 00시로 바꿔 넘긴 값 그대로
    out = refine_record(copy.deepcopy(AIRKOREA[2]))

    assert out["observed_at"] == "2024-01-02T00:00:00+09:00"
    assert out["observed_period_start"] == "2024-01-01T23:00:00+09:00"
    assert out["observed_period_end"] == "2024-01-02T00:00:00+09:00"
    assert out["geometry"] == {"type": "Point", "coordinates": [127.725967, 34.741301]}


@pytest.mark.parametrize("record", P1_SAMPLES, ids=SAMPLE_IDS)
def test_refine_does_not_change_input(record):
    record = copy.deepcopy(record)
    before = copy.deepcopy(record)

    refine_record(record)

    assert record == before


def test_changing_output_does_not_change_input():
    # P3 가 출력의 geometry 를 채우거나 고쳐도 P1 원본은 그대로여야 한다
    record = copy.deepcopy(AIRKOREA[0])
    before = copy.deepcopy(record)

    out = refine_record(record)
    out["geometry"]["coordinates"][0] = 0.0
    out["locator"]["sheet"] = "changed"

    assert record == before
