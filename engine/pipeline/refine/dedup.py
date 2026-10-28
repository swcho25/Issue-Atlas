"""중복: 같은 원천 칸의 판(최신본)과 같은 dedup_key 의 반복·충돌."""

import hashlib
import json
from datetime import datetime

# 수집 실행마다 바뀌는 칸. 이것만 다르면 같은 내용을 다시 받은 것(재수집)으로 본다
RUN_FIELDS = ("collected_at", "run_id", "collector_version")


def obs_key(record: dict) -> str | None:
    """원천의 같은 칸이면 판이 바뀌어도 같은 키. 관측값(indicator_id) · 문서(document)에 붙인다.

    문서는 원천 문서 하나(빅카인즈 news_id 등)가 한 칸이라, 같은 기사를 다시 받은 행이 한 키다.
    """
    if record.get("indicator_id") is None and not _is_document(record):
        return None
    where = {k: record.get(k) for k in ("source_id", "spec_id", "locator")}
    canon = json.dumps(where, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "obs:" + hashlib.sha256(canon.encode("utf-8")).hexdigest()


def split_repeats(records: list[dict]) -> tuple[list[dict], set[str]]:
    """같은 dedup_key·같은 내용(수집 실행 칸 빼고)은 마지막으로 확인한 것 하나만 남긴다.

    내용이 다른 dedup_key 는 충돌로 돌려준다. 남는 레코드는 입력 순서를 지킨다.
    """
    variants: dict[str, list[list]] = {}  # dedup_key → [[내용, 남길 레코드], ...]
    for record in records:
        key = record.get("dedup_key")
        if not isinstance(key, str):
            continue
        content = {k: v for k, v in record.items() if k not in RUN_FIELDS}
        for variant in variants.setdefault(key, []):
            if variant[0] == content:
                if _check_order(record) > _check_order(variant[1]):
                    variant[1] = record
                break
        else:
            variants[key].append([content, record])

    chosen = {id(v[1]) for vs in variants.values() for v in vs}
    kept = []
    for record in records:
        if not isinstance(record.get("dedup_key"), str):
            kept.append(record)
        elif id(record) in chosen:
            chosen.discard(id(record))  # 같은 객체가 두 번 와도 한 번만
            kept.append(record)
    conflicts = {key for key, vs in variants.items() if len(vs) > 1}
    return kept, conflicts


def mark_latest(refined: list[dict]) -> None:
    """같은 obs_key 중 보류가 아닌 판 하나만 is_latest. obs_key 가 없으면 None.

    관측값은 가장 늦게 공표된 판, 문서는 본문이 있는 판 중 가장 늦게 받은 판.
    """
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


def _check_order(r: dict) -> tuple:
    # 늦게 수집한 것이 크다. 같으면 run_id · collector_version 으로 정해 입력 순서와 상관없게.
    # 검증 전이라 collected_at 이 틀릴 수 있다 — 읽을 수 있는 시각이 늘 이긴다
    return (
        _parse_instant(r.get("collected_at")),
        str(r.get("run_id")),
        str(r.get("collector_version")),
    )


def _parse_instant(value) -> tuple:
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        return (0, str(value))
    return (1, parsed)


def _is_document(record: dict) -> bool:
    return isinstance(record.get("document"), dict)


def _revision_order(r: dict) -> tuple:
    if _is_document(r):
        # 같은 기사를 실패 → 성공으로 다시 받았으면 본문 있는 판이 먼저, 같으면 늦게 받은 판
        return (
            r["document"].get("body") is not None,
            datetime.fromisoformat(r["collected_at"]),
            r["dedup_key"],
        )
    # 공표 시각이 없으면(에어코리아 확정 파일) 수집 시각으로. 같으면 dedup_key 로 정해 늘 같은 결과
    published = r.get("published_at") or r["collected_at"]
    return (
        datetime.fromisoformat(published),
        datetime.fromisoformat(r["collected_at"]),
        r["dedup_key"],
    )
