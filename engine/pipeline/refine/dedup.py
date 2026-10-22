"""중복: 같은 원천 칸의 판(최신본)과 같은 dedup_key 의 반복·충돌."""

import hashlib
import json
from datetime import datetime


def obs_key(record: dict) -> str | None:
    """원천의 같은 칸이면 판이 바뀌어도 같은 키. 관측값 레코드(indicator_id 있음)에만 붙인다."""
    if record.get("indicator_id") is None:
        return None
    where = {k: record.get(k) for k in ("source_id", "spec_id", "locator")}
    canon = json.dumps(where, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "obs:" + hashlib.sha256(canon.encode("utf-8")).hexdigest()


def split_repeats(records: list[dict]) -> tuple[list[dict], set[str]]:
    """같은 dedup_key·같은 내용은 처음 것만 남긴다. 내용이 다른 dedup_key 는 충돌로 돌려준다."""
    kept, seen, conflicts = [], {}, set()
    for record in records:
        key = record.get("dedup_key")
        if not isinstance(key, str):
            kept.append(record)
            continue
        contents = seen.setdefault(key, [])
        if record in contents:
            continue
        if contents:
            conflicts.add(key)
        contents.append(record)
        kept.append(record)
    return kept, conflicts


def mark_latest(refined: list[dict]) -> None:
    """같은 obs_key 중 보류가 아닌 가장 늦은 판 하나만 is_latest. 관측값이 아니면 None."""
    groups: dict[str, list[dict]] = {}
    for r in refined:
        if r["obs_key"] is None:
            r["is_latest"] = None
            continue
        r["is_latest"] = False
        if r["validation_status"] != "held":
            groups.setdefault(r["obs_key"], []).append(r)
    for group in groups.values():
        max(group, key=_revision_order)["is_latest"] = True


def _revision_order(r: dict) -> tuple:
    # 공표 시각이 없으면(에어코리아 확정 파일) 수집 시각으로. 같으면 dedup_key 로 정해 늘 같은 결과
    published = r.get("published_at") or r["collected_at"]
    return (
        datetime.fromisoformat(published),
        datetime.fromisoformat(r["collected_at"]),
        r["dedup_key"],
    )
