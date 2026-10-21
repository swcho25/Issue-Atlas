"""레코드 1건을 정제 단계에 차례로 통과시킨다."""

from .url import mask_secrets
from .validate import validate

RULE_VERSION = "p2-0.1.0"


def refine_record(record: dict) -> dict:
    issues = validate(record)
    out = {
        **record,
        "validation_status": "held" if issues else "pass",
        "issues": issues,
        "rule_version": RULE_VERSION,
    }
    # held 레코드도 저장되므로 키는 어떤 경우에도 남기지 않는다
    if record.get("raw_url"):
        out["raw_url"] = mask_secrets(record["raw_url"])
    return out
