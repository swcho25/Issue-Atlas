import pytest

from pipeline.refine import RULE_VERSION, refine_record
from tests.samples import HASH, P1_SAMPLES, SAMPLE_IDS

# P1 C1 초안 2-1 표에서 필수(✓)인 칸. raw_url · file_name(둘 중 하나)은 따로 본다
REQUIRED = [
    "source_id",
    "spec_id",
    "content_hash",
    "collected_at",
    "observed_period_type",
    "place_code_raw",
    "place_map_status",
    "location_precision",
    "license_type",
    "storage_scope",
    "run_id",
    "collector_version",
]


@pytest.mark.parametrize("record", P1_SAMPLES, ids=SAMPLE_IDS)
def test_p1_sample_without_content_hash_is_held(record):
    out = refine_record(record)

    assert out["validation_status"] == "held"
    assert out["issues"] == [{"code": "MISSING_REQUIRED", "field": "content_hash"}]
    assert out["rule_version"] == RULE_VERSION


@pytest.mark.parametrize("record", P1_SAMPLES, ids=SAMPLE_IDS)
def test_p1_sample_with_content_hash_passes(record):
    # 결측값(value null)·raw_url 없는 파일 소스·P3 칸 null 은 필수 누락이 아니다
    out = refine_record({**record, "content_hash": HASH})

    assert out["validation_status"] == "pass"
    assert out["issues"] == []


@pytest.mark.parametrize("field", REQUIRED)
def test_missing_required_field_is_held(field):
    record = {**P1_SAMPLES[0], "content_hash": HASH}
    del record[field]

    out = refine_record(record)

    assert out["validation_status"] == "held"
    assert out["issues"] == [{"code": "MISSING_REQUIRED", "field": field}]


def test_empty_string_counts_as_missing():
    out = refine_record({**P1_SAMPLES[0], "content_hash": ""})

    assert out["issues"] == [{"code": "MISSING_REQUIRED", "field": "content_hash"}]
