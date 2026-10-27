"""raw_record 의 장부(c1_record)를 정제해 normalized_record(V0005)에 저장한다.

장부(C1 레코드)는 P1 이 원본과 함께 저장한다. P2 는 장부를 만들지 않고 읽기만 한다.
raw 한 행 = 정제 행 하나(content_hash 로 연결).
최신본은 같은 관측 칸(obs_key)끼리, 반복·충돌은 같은 dedup_key 끼리만 보면 된다. 두 키는 같은
관측 시각을 가리키므로 장부를 관측 일 묶음으로 나눠 한 묶음씩 정제·저장한다(메모리에는 한 묶음만).
키가 여러 묶음에 갈라진 레코드는 한 묶음으로 모아, 한 번에 정제한 결과와 같게 한다.
같은 장부·같은 규칙 판이면 저장 결과가 바뀌지 않고, 바뀐 행만 refined_at 이 새로 찍힌다.
"""

from collections import Counter

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .run import refine_records

# 묶음 이름: 관측 시작 시각(없으면 시점)의 날짜(YYYY-MM-DD). 시각이 없거나 읽을 수 없으면 ''
MIXED = "~"  # 키가 여러 묶음에 갈라진 레코드를 모으는 묶음 (날짜 · '' 와 겹치지 않는다)

# 원본 행마다 묶음 · 키를 한 번에 떠 둔다 (같은 시점의 원본만 다룬다).
# dedup · obs 는 dedup.split_repeats · dedup.obs_key 가 보는 값과 같다
PARTS = """
CREATE TEMP TABLE refine_part AS
SELECT r.id, s.source_id, r.c1_record IS NOT NULL AS has_ledger,
    -- 장부의 content_hash(없거나 null 이면 null)가 원본과 다르면 불일치
    coalesce(r.c1_record -> 'content_hash', 'null') IS DISTINCT FROM
        coalesce(to_jsonb(r.content_hash), 'null') AS mismatch,
    CASE WHEN jsonb_typeof(r.c1_record -> 'dedup_key') = 'string'
        THEN r.c1_record ->> 'dedup_key' END AS dedup,
    CASE WHEN r.c1_record ->> 'indicator_id' IS NOT NULL THEN jsonb_build_array(
        r.c1_record -> 'source_id', r.c1_record -> 'spec_id', r.c1_record -> 'locator'
    ) END AS obs,
    coalesce(substring(
        coalesce(r.c1_record ->> 'observed_period_start', r.c1_record ->> 'observed_at')
        FROM '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    ), '') AS bucket
FROM raw_record r
JOIN source_spec s ON s.spec_id = r.spec_id
"""
# 같은 키가 여러 묶음에 있으면 그 키의 레코드를 모두 MIXED 로 옮긴다. 더 옮길 것이 없을 때까지
MERGE = """
UPDATE refine_part p SET bucket = %(mixed)s
FROM (
    SELECT {key} AS k FROM refine_part
    WHERE has_ledger AND {key} IS NOT NULL
    GROUP BY {key} HAVING count(DISTINCT bucket) > 1
) split
WHERE p.{key} = split.k AND p.bucket <> %(mixed)s
"""
MISMATCH = "SELECT 1 FROM refine_part WHERE has_ledger AND mismatch LIMIT 1"
BUCKETS = "SELECT DISTINCT bucket FROM refine_part WHERE has_ledger ORDER BY bucket"
LEDGERS = """
SELECT r.content_hash, r.spec_id, r.c1_record, p.source_id
FROM refine_part p
JOIN raw_record r ON r.id = p.id
WHERE p.has_ledger AND p.bucket = %s
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
    """autocommit 연결. 장부가 없는 raw 는 건너뛰고 source_id 별로 센다. 묶음마다 커밋한다."""
    if not conn.autocommit:
        raise RefineStoreError("STORE_REQUIRES_AUTOCOMMIT")
    conn.execute("DROP TABLE IF EXISTS refine_part")
    try:
        conn.execute(PARTS)
        # 장부가 다른 원본을 가리키면 어느 쪽이 맞는지 모른다. 어느 묶음도 저장하기 전에 멈춘다
        if conn.execute(MISMATCH).fetchone():
            raise RefineStoreError("C1_HASH_MISMATCH")
        _merge_split_keys(conn)
        # 묶음마다 읽을 때 임시 표 전체를 훑지 않게 한다 (임시 표는 자동 통계가 없다)
        conn.execute("CREATE INDEX ON refine_part (bucket)")
        conn.execute("ANALYZE refine_part")
        raw, skipped = 0, Counter()
        for source_id, has_ledger, n in conn.execute(
            "SELECT source_id, has_ledger, count(*) FROM refine_part GROUP BY 1, 2"
        ):
            raw += n
            if not has_ledger:
                skipped[source_id] += n
        buckets = [row[0] for row in conn.execute(BUCKETS)]
        totals, status = Counter(), Counter()
        for bucket in buckets:
            _refine_bucket(conn, bucket, totals, status)
    finally:
        conn.execute("DROP TABLE IF EXISTS refine_part")
    return {
        "raw": raw,
        "skipped": dict(skipped),
        "buckets": len(buckets),
        "inserted": totals["inserted"],
        "updated": totals["updated"],
        "unchanged": totals["unchanged"],
        "status": dict(status),
    }


def _merge_split_keys(conn):
    while True:
        moved = sum(
            conn.execute(MERGE.format(key=key), {"mixed": MIXED}).rowcount
            for key in ("dedup", "obs")
        )
        if not moved:
            return


def _refine_bucket(conn, bucket, totals, status):
    with conn.cursor(row_factory=dict_row) as cur:
        raws = cur.execute(LEDGERS, (bucket,)).fetchall()
    origin = {}
    for raw in raws:
        # 미리 확인했지만 그사이 장부가 바뀌었다. 이 묶음부터는 저장하지 않고 멈춘다
        if raw["c1_record"].get("content_hash") != raw["content_hash"]:
            raise RefineStoreError("C1_HASH_MISMATCH")
        origin[raw["content_hash"]] = raw
    refined = refine_records([raw["c1_record"] for raw in raws])
    with conn.transaction():
        for r in refined:
            # 결과가 같으면 UPDATE 를 건너뛰어 행이 돌아오지 않는다
            row = conn.execute(UPSERT, _values(r, origin[r["content_hash"]])).fetchone()
            if row is None:
                totals["unchanged"] += 1
            else:
                totals["inserted" if row[0] else "updated"] += 1
    status.update(r["validation_status"] for r in refined)


def _values(r, raw):
    held = r["validation_status"] == "held"
    c1 = [None if held else r.get(c) for c in C1_COLUMNS]
    # 연결 칸은 장부가 아니라 원본 쪽 값을 쓴다 (held 장부는 칸이 비어 있을 수 있다)
    keys = [raw["content_hash"], r.get("dedup_key"), raw["source_id"], raw["spec_id"]]
    p2 = [r[c] for c in P2_COLUMNS]
    return [*keys, *c1, *p2, Jsonb(r["issues"]), Jsonb(r)]
