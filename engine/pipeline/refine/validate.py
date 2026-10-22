"""검증: 레코드를 고치지 않고, 다음 단계로 넘기면 안 되는 사유만 모은다."""

from .schema import schema_issues
from .url import is_forbidden_host, mask_secrets

# P1 C1 초안 2-1 의 필수(✓) 칸. 순서대로 검사해 issues 순서가 늘 같게 한다
REQUIRED_FIELDS = (
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
)


def validate(record: dict) -> list[dict]:
    issues = [
        {"code": "MISSING_REQUIRED", "field": field}
        for field in REQUIRED_FIELDS
        if _missing(record, field)
    ]
    # raw_url · file_name 은 둘 중 하나만 있으면 된다
    if _missing(record, "raw_url") and _missing(record, "file_name"):
        issues.append({"code": "MISSING_REQUIRED", "field": "raw_url|file_name"})

    raw_url = record.get("raw_url")
    if raw_url:
        if is_forbidden_host(raw_url):
            issues.append({"code": "FORBIDDEN_SOURCE", "field": "raw_url"})
        if mask_secrets(raw_url) != raw_url:
            issues.append({"code": "SECRET_IN_URL", "field": "raw_url"})

    # P2 규칙이 먼저, C1 스키마 결과는 그 뒤. P2 규칙이 이미 잡은 사유는 다시 넣지 않는다
    issues.extend(i for i in schema_issues(record) if i not in issues)
    return issues


def _missing(record: dict, field: str) -> bool:
    return record.get(field) in (None, "")
