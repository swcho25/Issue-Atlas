"""C1 계약 스키마(contracts/c1/record.schema.json) 검사.

허용값·필수 키·조건 규칙은 스키마 파일에만 있다.
여기서는 스키마 오류를 P2 사유 코드로 옮기기만 한다.
"""

import json
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator

C1_SCHEMA_PATH = Path(__file__).resolve().parents[3] / "contracts" / "c1" / "record.schema.json"


@cache
def load_c1_schema() -> dict:
    return json.loads(C1_SCHEMA_PATH.read_text(encoding="utf-8"))


@cache
def _default_validator() -> Draft202012Validator:
    return _validator(load_c1_schema())


def _validator(schema: dict) -> Draft202012Validator:
    # date-time 형식 검사는 rfc3339-validator 가 있어야 켜진다
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def schema_issues(record: dict, schema: dict | None = None) -> list[dict]:
    """스키마에 어긋난 곳을 (code, field) 순으로 정렬해 돌려준다. 같은 사유는 한 번만."""
    validator = _default_validator() if schema is None else _validator(schema)
    found = set()
    for error in validator.iter_errors(record):
        found.update(_to_issues(error, record))
    return [{"code": code, "field": field} for code, field in sorted(found)]


def _to_issues(error, record: dict) -> list[tuple[str, str]]:
    if error.absolute_path:
        # 칸 안의 값이 틀림. geometry.coordinates[0] 처럼 깊어도 최상위 칸 이름으로 묶는다
        return [("INVALID_VALUE", str(error.absolute_path[0]))]
    if error.validator == "required":
        return [("MISSING_REQUIRED", f) for f in error.validator_value if f not in record]
    if error.validator == "additionalProperties":
        known = error.schema.get("properties", {})
        return [("UNKNOWN_FIELD", f) for f in record if f not in known]
    if error.validator in ("anyOf", "oneOf"):
        # 여러 칸을 묶은 규칙(raw_url|file_name, value|missing_reason).
        # 다 비었으면 누락, 아니면 잘못된 조합
        branches = error.validator_value
        fields = list(dict.fromkeys(f for b in branches for f in b.get("required", [])))
        code = "MISSING_REQUIRED" if all(record.get(f) is None for f in fields) else "INVALID_VALUE"
        return [(code, "|".join(fields))]
    return [("INVALID_VALUE", "(record)")]
