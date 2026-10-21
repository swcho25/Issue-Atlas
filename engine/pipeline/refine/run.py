"""레코드 1건을 정제 단계에 차례로 통과시킨다."""

from .validate import validate

RULE_VERSION = "p2-0.1.0"


def refine_record(record: dict) -> dict:
    issues = validate(record)
    return {
        **record,
        "validation_status": "held" if issues else "pass",
        "issues": issues,
        "rule_version": RULE_VERSION,
    }
