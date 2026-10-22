import copy

import pytest

from pipeline.refine import refine_record
from pipeline.refine.schema import load_c1_schema, schema_issues
from tests.samples import AIRKOREA, HASH, KOSIS, STATION


def kosis(**changes):
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH, **changes}


def pm25(**changes):
    return {**copy.deepcopy(AIRKOREA[0]), "content_hash": HASH, **changes}


def without(record, field):
    record = copy.deepcopy(record)
    del record[field]
    return record


def issue(code, field):
    return {"code": code, "field": field}


# 기대값은 C1 스키마(contracts/c1/record.schema.json v0.1)를 손으로 읽고 적었다
@pytest.mark.parametrize(
    ("record", "expected"),
    [
        pytest.param(
            kosis(observed_period_type="X"),
            [issue("INVALID_VALUE", "observed_period_type")],
            id="기간 종류가 허용값 밖",
        ),
        pytest.param(
            kosis(storage_scope="everything"),
            [issue("INVALID_VALUE", "storage_scope")],
            id="저장 범위가 허용값 밖",
        ),
        pytest.param(
            kosis(value="-747"),
            [issue("INVALID_VALUE", "value"), issue("INVALID_VALUE", "value|missing_reason")],
            id="숫자 자리에 글자",
        ),
        pytest.param(
            kosis(collected_at="어제"),
            [issue("INVALID_VALUE", "collected_at")],
            id="수집 시각이 시각 형식 아님",
        ),
        pytest.param(
            pm25(value=None, missing_reason=None),
            [issue("MISSING_REQUIRED", "value|missing_reason")],
            id="값도 결측 사유도 없음",
        ),
        pytest.param(
            pm25(value=25, missing_reason="not_published"),
            [issue("INVALID_VALUE", "value|missing_reason")],
            id="값과 결측 사유가 둘 다 있음",
        ),
        pytest.param(
            kosis(location_precision="exact"),
            [issue("INVALID_VALUE", "location_precision")],
            id="좌표 없는데 정밀도 exact",
        ),
        pytest.param(
            kosis(observed_period_start=None),
            [issue("INVALID_VALUE", "observed_period_start")],
            id="연 통계인데 기간 시작 없음",
        ),
        pytest.param(
            {
                **copy.deepcopy(STATION[0]),
                "content_hash": HASH,
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            },
            [issue("INVALID_VALUE", "geometry")],
            id="좌표가 한국 범위 밖",
        ),
        pytest.param(
            without(kosis(), "unit"),
            [issue("MISSING_REQUIRED", "unit")],
            id="C1 필수 키 없음",
        ),
        pytest.param(
            kosis(description="RSS 요약문"),
            [issue("UNKNOWN_FIELD", "description")],
            id="C1에 없는 칸",
        ),
    ],
)
def test_record_breaking_c1_schema_is_held(record, expected):
    out = refine_record(record)

    assert out["validation_status"] == "held"
    assert out["issues"] == expected


def test_p2_rule_issues_come_before_schema_issues():
    out = refine_record(kosis(content_hash=None, storage_scope="everything"))

    assert out["issues"] == [
        issue("MISSING_REQUIRED", "content_hash"),
        issue("INVALID_VALUE", "storage_scope"),
    ]


def test_same_problem_reported_once_by_p2_rule_and_schema():
    # content_hash 키가 아예 없으면 P2 필수 칸 검사와 스키마 required 가 둘 다 잡는다
    out = refine_record(without(kosis(), "content_hash"))

    assert out["issues"] == [issue("MISSING_REQUIRED", "content_hash")]


def test_allowed_values_come_from_schema_file():
    # 스키마의 enum 만 바꾸면 결과가 따라 바뀐다 (P2 코드에 허용값을 따로 두지 않는다)
    schema = copy.deepcopy(load_c1_schema())
    schema["properties"]["observed_period_type"]["enum"].remove("Y")
    schema["properties"]["storage_scope"]["enum"].append("everything")

    assert schema_issues(kosis(), schema) == [issue("INVALID_VALUE", "observed_period_type")]
    assert schema_issues(kosis(storage_scope="everything", observed_period_type="M"), schema) == []
