"""raw_record 의 장부(c1_record)를 정제해 normalized_record(V0005)에 저장한다.

장부(C1 레코드)는 P1 이 원본과 함께 저장한다. P2 는 장부를 만들지 않고 읽기만 한다.
raw 한 행 = 정제 행 하나(content_hash 로 연결).
최신본·충돌은 다른 행을 봐야 알 수 있어 한 번에 정제한다.
같은 장부·같은 규칙 판이면 저장 결과가 바뀌지 않고, 바뀐 행만 refined_at 이 새로 찍힌다.
"""

from collections import Counter

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .run import refine_records

RAW_QUERY = """
SELECT r.content_hash, r.spec_id, r.c1_record, s.source_id
FROM raw_record r
JOIN source_spec s ON s.spec_id = r.spec_id
ORDER BY r.id
"""

# 보류(held)가 아닐 때만 채우는 C1 칸. held 레코드는 C1 을 어길 수 있어 record 에만 남긴다
C1_COLUMNS = (
    "indicator_id",
    "place_code_system",
    "place_code_raw",
    "observed_period_type",
    "observed_period_start",
    "observed_period_end",
    "observed_at",
    "value",
    "unit",
    "missing_reason",
    "storage_scope",
)
P2_COLUMNS = ("validation_status", "rule_version", "obs_key", "is_latest")
COLUMNS = ("content_hash", "dedup_key", "source_id", "spec_id", *C1_COLUMNS, *P2_COLUMNS)

UPSERT = f"""
INSERT INTO normalized_record ({", ".join(COLUMNS)}, issues, record)
VALUES ({", ".join(["%s"] * (len(COLUMNS) + 2))})
ON CONFLICT (content_hash) DO UPDATE SET
    {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS[1:])},
    issues = EXCLUDED.issues, record = EXCLUDED.record, refined_at = now()
WHERE normalized_record.record IS DISTINCT FROM EXCLUDED.record
RETURNING (xmax = 0) AS inserted
"""


class RefineStoreError(Exception):
    """장부·연결 상태가 저장 규칙과 맞지 않을 때의 고정 원인 코드."""


def refine_raw(conn) -> dict:
    """autocommit 연결. 장부가 없는 raw 는 건너뛰고 source_id 별로 센다."""
    if not conn.autocommit:
        raise RefineStoreError("STORE_REQUIRES_AUTOCOMMIT")
    with conn.cursor(row_factory=dict_row) as cur:
        raws = cur.execute(RAW_QUERY).fetchall()
    ledgers, origin, skipped = [], {}, Counter()
    for raw in raws:
        ledger = raw["c1_record"]
        if ledger is None:
            skipped[raw["source_id"]] += 1
            continue
        # 장부가 다른 원본을 가리키면 어느 쪽이 맞는지 모른다. 일부만 저장하지 않고 멈춘다
        if ledger.get("content_hash") != raw["content_hash"]:
            raise RefineStoreError("C1_HASH_MISMATCH")
        ledgers.append(ledger)
        origin[raw["content_hash"]] = raw
    refined = refine_records(ledgers)
    inserted = updated = 0
    with conn.transaction():
        for r in refined:
            # 결과가 같으면 UPDATE 를 건너뛰어 행이 돌아오지 않는다
            row = conn.execute(UPSERT, _values(r, origin[r["content_hash"]])).fetchone()
            if row is not None:
                inserted += row[0]
                updated += not row[0]
    return {
        "raw": len(raws),
        "skipped": dict(skipped),
        "inserted": inserted,
        "updated": updated,
        "unchanged": len(refined) - inserted - updated,
        "status": dict(Counter(r["validation_status"] for r in refined)),
    }


def _values(r, raw):
    held = r["validation_status"] == "held"
    c1 = [None if held else r.get(c) for c in C1_COLUMNS]
    # 연결 칸은 장부가 아니라 원본 쪽 값을 쓴다 (held 장부는 칸이 비어 있을 수 있다)
    keys = [raw["content_hash"], r.get("dedup_key"), raw["source_id"], raw["spec_id"]]
    p2 = [r[c] for c in P2_COLUMNS]
    return [*keys, *c1, *p2, Jsonb(r["issues"]), Jsonb(r)]
