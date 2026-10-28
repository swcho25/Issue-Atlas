"""저장 범위 게이트: 이용허락이 허락하는 만큼만 남긴다.

이용허락별 최대 범위는 license_scopes.json 에만 둔다. 관측값 · 문서 레코드에 같은 표를 쓴다.
"""

import copy
import json
from functools import cache
from pathlib import Path

LICENSE_SCOPES_PATH = Path(__file__).with_name("license_scopes.json")

# 좁은 것부터. 최종 범위 = min(P1 이 정한 범위, 이용허락의 최대 범위)
SCOPE_ORDER = ("link_only", "metadata", "full")


@cache
def load_license_scopes() -> dict:
    return json.loads(LICENSE_SCOPES_PATH.read_text(encoding="utf-8"))["limits"]


def apply_storage_scope(record: dict, scopes: dict | None = None) -> tuple[dict, list[dict]]:
    """범위를 적용한 새 레코드와 사유를 돌려준다. 입력 레코드는 바꾸지 않는다."""
    scopes = load_license_scopes() if scopes is None else scopes
    out = copy.deepcopy(record)
    license_type = record.get("license_type")
    scope = record.get("storage_scope")
    # 칸이 비었거나 허용값 밖이면 검증 단계가 이미 보류 사유를 붙였다
    if not license_type or scope not in SCOPE_ORDER:
        return out, []
    if license_type not in scopes:
        # 범위를 정할 수 없으니 레코드는 그대로 두고 보류만 한다
        return out, [{"code": "LICENSE_UNKNOWN", "field": "license_type"}]

    issues = []
    limit = scopes[license_type]
    if SCOPE_ORDER.index(scope) > SCOPE_ORDER.index(limit):
        out["storage_scope"] = limit
        issues.append({"code": "SCOPE_DOWNGRADED", "field": "storage_scope"})
    # 관측값은 숫자 자체가 내용이라 full 이 아니면 값을 남기지 않는다
    if out["storage_scope"] != "full" and out.get("value") is not None:
        out["value"] = None
        out["missing_reason"] = "license_blocked"
        issues.append({"code": "VALUE_STRIPPED_BY_SCOPE", "field": "value"})
    # 문서는 본문이 내용이라 full 이 아니면 본문을 남기지 않는다 (C1 v0.2: full ⇔ 본문 있음)
    document = out.get("document")
    if (
        out["storage_scope"] != "full"
        and isinstance(document, dict)
        and document.get("body") is not None
    ):
        document["body"] = None
        issues.append({"code": "BODY_STRIPPED_BY_SCOPE", "field": "document"})
    # 기사는 본문을 읽어 지역 · 시간 · 요약을 뽑는다. 이용허락이 본문을 허락하는데 본문이 없으면
    # (원문 링크 없음 · robots 차단 등) 보류해 다음 단계로 넘기지 않는다.
    # 다시 받아 본문이 생기면 그 판이 나간다
    if (
        limit == "full"
        and isinstance(document, dict)
        and document.get("kind") == "news"
        and document.get("body") is None
    ):
        issues.append({"code": "BODY_MISSING", "field": "document"})
    return out, issues
