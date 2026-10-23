import copy

import pytest

from pipeline.refine import refine_record
from pipeline.refine.schema import schema_issues
from pipeline.refine.storage import apply_storage_scope
from tests.samples import AIRKOREA, HASH, KOSIS, OBSERVATION_IDS, OBSERVATIONS, STATION


def kosis(**changes):
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH, **changes}


def issue(code, field):
    return {"code": code, "field": field}


def c1_part(out, record):
    # 정제 칸(validation_status 등)을 뺀 C1 레코드 부분
    return {k: out[k] for k in record}


@pytest.mark.parametrize("record", OBSERVATIONS, ids=OBSERVATION_IDS)
def test_contract_observations_keep_full_scope_and_value(record):
    out = refine_record({**copy.deepcopy(record), "content_hash": HASH})

    assert out["validation_status"] == "pass"
    assert out["storage_scope"] == "full"
    assert out["value"] == record["value"]
    assert out["missing_reason"] == record["missing_reason"]


def test_station_record_with_tbd_license_is_held():
    record = {**copy.deepcopy(STATION[0]), "content_hash": HASH}

    out = refine_record(record)

    assert out["validation_status"] == "held"
    assert out["issues"] == [issue("LICENSE_UNKNOWN", "license_type")]
    # 이용허락을 모르면 범위를 정할 수 없어 레코드는 그대로 두고 보류만 한다
    assert c1_part(out, record) == record


@pytest.mark.parametrize("license_type", ["TBD", "CC-BY-4.0"])
def test_license_not_in_table_is_held(license_type):
    out = refine_record(kosis(license_type=license_type))

    assert out["validation_status"] == "held"
    assert out["issues"] == [issue("LICENSE_UNKNOWN", "license_type")]
    assert out["storage_scope"] == "full"
    assert out["value"] == -747


def test_scope_wider_than_license_is_lowered_and_value_removed():
    # KOGL-2 는 비영리 조건이라 관측값을 metadata 까지만 둔다 (초안 표)
    record = kosis(license_type="KOGL-2")

    out = refine_record(record)

    assert out["validation_status"] == "fixed"
    assert out["issues"] == [
        issue("SCOPE_DOWNGRADED", "storage_scope"),
        issue("VALUE_STRIPPED_BY_SCOPE", "value"),
    ]
    assert out["storage_scope"] == "metadata"
    assert out["value"] is None
    assert out["missing_reason"] == "license_blocked"
    assert schema_issues(c1_part(out, record)) == []


@pytest.mark.parametrize(
    ("license_type", "storage_scope"),
    [("KOGL-2", "link_only"), ("KOSIS-활용약관", "metadata")],
)
def test_scope_narrower_than_license_is_kept(license_type, storage_scope):
    out = refine_record(kosis(license_type=license_type, storage_scope=storage_scope))

    assert out["storage_scope"] == storage_scope
    # full 이 아니니 값은 여전히 남기지 않는다
    assert out["issues"] == [issue("VALUE_STRIPPED_BY_SCOPE", "value")]
    assert out["value"] is None
    assert out["missing_reason"] == "license_blocked"


def test_missing_value_keeps_its_own_reason():
    # 02시 빈칸(not_published)은 지울 값이 없으니 결측 사유를 바꾸지 않는다
    record = {**copy.deepcopy(AIRKOREA[1]), "content_hash": HASH, "license_type": "KOGL-4"}

    out = refine_record(record)

    assert out["validation_status"] == "fixed"
    assert out["issues"] == [issue("SCOPE_DOWNGRADED", "storage_scope")]
    assert out["value"] is None
    assert out["missing_reason"] == "not_published"


def test_scope_is_applied_to_held_record_too():
    # 보류 레코드도 저장되므로 저장 범위는 똑같이 적용한다
    out = refine_record(kosis(license_type="KOGL-4", content_hash=None))

    assert out["validation_status"] == "held"
    assert out["issues"] == [
        issue("MISSING_REQUIRED", "content_hash"),
        issue("SCOPE_DOWNGRADED", "storage_scope"),
        issue("VALUE_STRIPPED_BY_SCOPE", "value"),
    ]
    assert out["value"] is None


def test_scope_limits_come_from_table():
    # 표만 바꾸면 결과가 따라 바뀐다 (P2 코드에 이용허락 값을 따로 두지 않는다)
    out, issues = apply_storage_scope(kosis(), {"KOSIS-활용약관": "link_only"})

    assert out["storage_scope"] == "link_only"
    assert issues == [
        issue("SCOPE_DOWNGRADED", "storage_scope"),
        issue("VALUE_STRIPPED_BY_SCOPE", "value"),
    ]


def test_gate_does_not_change_input():
    record = kosis(license_type="KOGL-2")
    before = copy.deepcopy(record)

    apply_storage_scope(record)

    assert record == before
