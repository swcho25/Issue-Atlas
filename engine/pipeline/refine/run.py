"""레코드를 정제 단계에 차례로 통과시킨다."""

from .dedup import mark_latest, obs_key, split_repeats
from .normalize import clean_number
from .storage import apply_storage_scope
from .url import mask_secrets
from .validate import validate

# 정제 결과가 달라지는 규칙 변경(금지 소스·이용허락 표 등)마다 올린다
RULE_VERSION = "p2-0.3.0"

# P2 가 고치고 넘기는 사유. 이것만 있으면 fixed, 그 밖의 사유가 하나라도 있으면 held
FIX_CODES = frozenset({"SCOPE_DOWNGRADED", "VALUE_STRIPPED_BY_SCOPE", "BODY_STRIPPED_BY_SCOPE"})


def refine_record(record: dict) -> dict:
    """레코드 1건. 다른 레코드를 봐야 아는 is_latest 는 refine_records 가 붙인다."""
    issues = validate(record)
    # held 레코드도 저장되므로 저장 범위는 늘 적용한다. 출력은 입력과 객체를 나누지 않는다
    out, scope_issues = apply_storage_scope(record)
    issues += scope_issues
    if "value" in out:
        out["value"] = clean_number(out["value"])
    out.update(
        validation_status=_status(issues),
        issues=issues,
        rule_version=RULE_VERSION,
        obs_key=obs_key(record),
    )
    # held 레코드도 저장되므로 키는 어떤 경우에도 남기지 않는다
    if record.get("raw_url"):
        out["raw_url"] = mask_secrets(record["raw_url"])
    return out


def refine_records(records: list[dict]) -> list[dict]:
    """한 번에 받은 레코드 묶음. 입력 순서를 지키고, 반복(재수집 포함)은 한 번만 낸다."""
    kept, conflicts = split_repeats(records)
    refined = []
    for record in kept:
        out = refine_record(record)
        if out.get("dedup_key") in conflicts:
            out["issues"].append({"code": "DEDUP_KEY_CONFLICT", "field": "dedup_key"})
            out["validation_status"] = _status(out["issues"])
        refined.append(out)
    mark_latest(refined)
    return refined


def _status(issues: list[dict]) -> str:
    if not issues:
        return "pass"
    return "fixed" if all(i["code"] in FIX_CODES for i in issues) else "held"
