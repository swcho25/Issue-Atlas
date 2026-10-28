import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pipeline.refine import refine_records
from pipeline.refine.schema import schema_issues
from tests.samples import HASH, KOSIS, NEWS, P1_SAMPLES

P2_SCHEMA = Path(__file__).resolve().parents[2] / "contracts" / "p2" / "refined-record.schema.json"


def p2_errors(refined):
    schema = json.loads(P2_SCHEMA.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)
    return [e.message for e in validator.iter_errors(refined)]


def kosis(**changes):
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH, **changes}


def news(**changes):
    return {**copy.deepcopy(NEWS[0]), "content_hash": HASH, **changes}


# 사유 코드마다 그 코드가 나오는 레코드 하나. 코드를 새로 만들면 여기와 출력 스키마에 같이 넣는다
ONE_PER_CODE = {
    "MISSING_REQUIRED": kosis(content_hash=None),
    "FORBIDDEN_SOURCE": kosis(raw_url="https://openapi.naver.com/v1/search/news.json"),
    "SECRET_IN_URL": kosis(raw_url="https://kosis.kr/x?apiKey=abc123"),
    "INVALID_VALUE": kosis(storage_scope="everything"),
    "UNKNOWN_FIELD": kosis(description="RSS 요약문"),
    "LICENSE_UNKNOWN": kosis(license_type="TBD"),
    "SCOPE_DOWNGRADED": kosis(license_type="KOGL-2"),
    "VALUE_STRIPPED_BY_SCOPE": kosis(license_type="KOGL-2"),
    "BODY_STRIPPED_BY_SCOPE": news(license_type="KOGL-4"),
}


@pytest.mark.parametrize("content_hash", [None, HASH], ids=["held", "pass"])
def test_refined_contract_examples_match_p2_schema(content_hash):
    records = [{**copy.deepcopy(r), "content_hash": content_hash} for r in P1_SAMPLES]

    for refined in refine_records(records):
        assert p2_errors(refined) == [], refined["dedup_key"]


@pytest.mark.parametrize("code", ONE_PER_CODE)
def test_every_issue_code_matches_p2_schema(code):
    (refined,) = refine_records([ONE_PER_CODE[code]])

    assert code in [i["code"] for i in refined["issues"]]
    assert p2_errors(refined) == []


def test_conflict_code_matches_p2_schema():
    out = refine_records([kosis(), kosis(value=-1)])

    for refined in out:
        assert refined["issues"] == [{"code": "DEDUP_KEY_CONFLICT", "field": "dedup_key"}]
        assert p2_errors(refined) == []


def test_pass_and_fixed_records_keep_a_valid_c1_part():
    # C1 칸만 떼면 C1 스키마를 그대로 통과한다 (held 는 C1 을 어긴 채 보관될 수 있다)
    records = [{**copy.deepcopy(r), "content_hash": HASH} for r in P1_SAMPLES]
    records.append(kosis(license_type="KOGL-2", dedup_key="fixed-case"))
    records.append(news(license_type="BIGKINDS-이용약관", dedup_key="news-full"))
    records.append(news(license_type="KOGL-4", dedup_key="news-body-stripped"))

    for record, refined in zip(records, refine_records(records), strict=True):
        if refined["validation_status"] == "held":
            continue
        c1_part = {k: v for k, v in refined.items() if k in record}
        assert schema_issues(c1_part) == [], refined["dedup_key"]


@pytest.mark.parametrize(
    "broken",
    [
        {"validation_status": "pass", "issues": [{"code": "INVALID_VALUE", "field": "value"}]},
        {"validation_status": "held", "issues": []},
        {"validation_status": "fixed", "issues": [{"code": "MISSING_REQUIRED", "field": "x"}]},
        {"validation_status": "held", "issues": [{"code": "SCOPE_DOWNGRADED", "field": "x"}]},
        {"issues": [{"code": "NOT_A_CODE", "field": "x"}]},
        {"obs_key": "abc"},
        {"obs_key": "obs:1234"},
        {"obs_key": None},
        {"rule_version": "v1"},
    ],
)
def test_p2_schema_rejects_inconsistent_records(broken):
    (refined,) = refine_records([kosis()])

    assert p2_errors({**refined, **broken}) != []
