"""검증: 레코드를 고치지 않고, 다음 단계로 넘기면 안 되는 사유만 모은다."""

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
    return [
        {"code": "MISSING_REQUIRED", "field": field}
        for field in REQUIRED_FIELDS
        if record.get(field) in (None, "")
    ]
