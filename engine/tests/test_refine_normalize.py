import copy

import pytest

from pipeline.refine import refine_record
from tests.samples import AIRKOREA, HASH, KOSIS


def pm25(value):
    return {**copy.deepcopy(AIRKOREA[0]), "content_hash": HASH, "value": value}


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        # 「데이터」 3절 #11: 에어코리아 확정 파일에서 실제로 나온 값
        (0.0033000000000000004, 0.0033),
        (0.30000000000000004, 0.3),
    ],
)
def test_float_noise_is_cleaned(raw, clean):
    out = refine_record(pm25(raw))

    assert out["value"] == clean
    # 표현 오차만 지우는 것이라 사유를 붙이지 않는다
    assert out["validation_status"] == "pass"
    assert out["issues"] == []


@pytest.mark.parametrize("value", [25, -747, 0, 0.0186, 1234567890123.5])
def test_ordinary_values_are_unchanged(value):
    out = refine_record(pm25(value))

    assert out["value"] == value
    assert type(out["value"]) is type(value)


def test_record_without_value_key_gets_no_value_key():
    record = {**copy.deepcopy(KOSIS[0]), "content_hash": HASH}
    del record["value"]

    out = refine_record(record)

    assert "value" not in out


def test_integer_stays_integer_in_output():
    # 25 가 25.0 으로 바뀌면 JSON 바이트도 바뀐다
    out = refine_record({**copy.deepcopy(KOSIS[0]), "content_hash": HASH})

    assert out["value"] == -747
    assert type(out["value"]) is int
