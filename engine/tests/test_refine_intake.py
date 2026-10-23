"""수집기 입구 검사(validate): 원본으로도 남으면 안 되는 것만 잡고, 저장 뒤 P2 판정은 보지 않는다."""

import copy

import pytest

from pipeline.refine import refine_records, validate
from tests.samples import HASH, KOSIS

# 저장 뒤 P2 정제가 판정하는 것. 입구 검사가 막으면 원본이 사라진다
AFTER_STORAGE = {
    "license_unknown": {"license_type": "KOGL-9"},  # 표에 없음 → held
    "scope_narrower": {"license_type": "KOGL-2"},  # 범위를 낮추고 값을 지움 → fixed
}

# 원본으로도 남으면 안 되는 것
MUST_NOT_STORE = {
    "forbidden_source": (
        {"raw_url": "https://openapi.naver.com/v1/search/news.json?query=x"},
        "FORBIDDEN_SOURCE",
    ),
    "secret_in_url": ({"raw_url": "https://kosis.kr/openapi/x?apiKey=real-key"}, "SECRET_IN_URL"),
    "c1_shape": ({"observed_period_type": "X"}, "INVALID_VALUE"),
    "missing_hash": ({"content_hash": None}, "MISSING_REQUIRED"),
}


def kosis():
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH}


@pytest.mark.parametrize("change", AFTER_STORAGE.values(), ids=AFTER_STORAGE)
def test_intake_ignores_license_and_scope(change):
    record = {**kosis(), **change}

    assert refine_records([record])[0]["validation_status"] != "pass"
    assert validate(record) == []


def test_intake_ignores_dedup_conflict():
    first, conflicting = kosis(), {**kosis(), "value": -1}

    assert {r["validation_status"] for r in refine_records([first, conflicting])} == {"held"}
    assert validate(first) == [] and validate(conflicting) == []


@pytest.mark.parametrize("change,code", MUST_NOT_STORE.values(), ids=MUST_NOT_STORE)
def test_intake_catches_what_must_not_be_stored(change, code):
    assert code in {i["code"] for i in validate({**kosis(), **change})}
