"""raw_record 의 장부(c1_record)를 정제해 normalized_record(V0005)에 저장한다.

장부(C1 레코드)는 P1 이 원본과 함께 저장한다. P2 는 장부를 만들지 않고 읽기만 한다.
raw 한 행 = 정제 행 하나(content_hash 로 연결).
최신본은 같은 관측 칸(obs_key)끼리, 반복·충돌은 같은 dedup_key 끼리만 보면 된다. 두 키는 같은
관측 시각을 가리키므로 장부를 관측 일 묶음으로 나눠 한 묶음씩 정제·저장한다(메모리에는 한 묶음만).
키가 여러 묶음에 갈라진 레코드는 한 묶음으로 모아, 한 번에 정제한 결과와 같게 한다.
같은 장부·같은 규칙 판이면 저장 결과가 바뀌지 않고, 바뀐 행만 refined_at 이 새로 찍힌다.
에어코리아 확정 시간값은 normalized_record 에 넣지 않고, 묶음마다 측정소 × 지표 × 월 합계에 더해
두었다가 정제가 끝나면 월별 표(air_monthly, V0009)를 다시 쓴다.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal

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
    CASE WHEN r.c1_record IS NOT NULL THEN jsonb_build_array(
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

# 시간값을 월별로만 저장하는 출처. 원본(raw_record)은 시간 단위 그대로다
AIR_SOURCE = "airkorea_final"
KST = timezone(timedelta(hours=9))
AIR_COLUMNS = (
    "station_code",
    "station_name",
    "indicator_id",
    "unit",
    "month_start",
    "month_end",
    "month_hours",
    "valid_hours",
    "held_hours",
    "value_mean",
    "value_min",
    "value_max",
    "has_provisional",
)
AIR_INSERT = f"INSERT INTO air_monthly ({', '.join(AIR_COLUMNS)}) VALUES ({', '.join(['%s'] * 13)})"


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
        totals, status, air = Counter(), Counter(), AirMonthly()
        for bucket in buckets:
            _refine_bucket(conn, bucket, totals, status, air)
    finally:
        conn.execute("DROP TABLE IF EXISTS refine_part")
    # 모든 묶음을 더한 뒤 한 번에 바꾼다. 쓰는 동안 읽는 쪽은 이전 월별 값을 본다
    air_monthly = air.save(conn)
    return {
        "raw": raw,
        "skipped": dict(skipped),
        "buckets": len(buckets),
        "inserted": totals["inserted"],
        "updated": totals["updated"],
        "unchanged": totals["unchanged"],
        "status": dict(status),
        "air_monthly": air_monthly,
        "air_unplaced": air.unplaced,
    }


def _merge_split_keys(conn):
    while True:
        moved = sum(
            conn.execute(MERGE.format(key=key), {"mixed": MIXED}).rowcount
            for key in ("dedup", "obs")
        )
        if not moved:
            return


def _refine_bucket(conn, bucket, totals, status, air):
    with conn.cursor(row_factory=dict_row) as cur:
        raws = cur.execute(LEDGERS, (bucket,)).fetchall()
    origin = {}
    for raw in raws:
        # 미리 확인했지만 그사이 장부가 바뀌었다. 이 묶음부터는 저장하지 않고 멈춘다
        if raw["c1_record"].get("content_hash") != raw["content_hash"]:
            raise RefineStoreError("C1_HASH_MISMATCH")
        origin[raw["content_hash"]] = raw
    refined = refine_records([raw["c1_record"] for raw in raws])
    hourly = [r for r in refined if origin[r["content_hash"]]["source_id"] == AIR_SOURCE]
    # 같은 관측 칸의 판은 모두 이 묶음에 있으므로 최신본 고르기가 끝난 값을 월 합계에 더한다
    air.add(hourly)
    with conn.transaction():
        for r in refined:
            if origin[r["content_hash"]]["source_id"] == AIR_SOURCE:
                continue
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


class AirMonthly:
    """에어코리아 시간값의 측정소 × 지표 × 월(한국 시각) 합계. 메모리에는 월 칸만 남는다."""

    def __init__(self):
        self.months = {}
        self.unplaced = 0  # 측정소 · 지표 · 시간 칸을 읽을 수 없어 어느 달에도 넣지 못한 레코드

    def add(self, refined):
        by_obs = {}
        for r in refined:
            by_obs.setdefault(r.get("obs_key"), []).append(r)
        for obs_key, versions in by_obs.items():
            if obs_key is None:
                self.unplaced += len(versions)
                continue
            # 한 시간 = 관측 칸 하나. 보류가 아닌 최신본이 있으면 그 값, 없으면 보류 시간
            latest = [r for r in versions if r["is_latest"]]
            r = latest[0] if latest else versions[0]
            key = _month_key(r)
            if key is None:
                self.unplaced += 1
                continue
            month = self.months.setdefault(key, _Month())
            month.add(r, held=not latest)

    def save(self, conn) -> int:
        rows = [m.row(*key) for key, m in sorted(self.months.items())]
        with conn.transaction():
            conn.execute("DELETE FROM air_monthly")
            with conn.cursor() as cur:
                cur.executemany(AIR_INSERT, rows)
        return len(rows)


class _Month:
    def __init__(self):
        self.names, self.units = set(), set()
        self.valid = self.held = 0
        self.total, self.low, self.high = Decimal(0), None, None
        self.provisional = False

    def add(self, r, held):
        name = (r.get("locator") or {}).get("측정소명")
        if name:
            self.names.add(name)
        if held:
            self.held += 1
            return
        self.units.add(r.get("unit"))
        self.provisional = self.provisional or bool(r.get("is_provisional"))
        if r.get("value") is None:  # 결측(−999 · 빈칸)
            return
        value = Decimal(str(r["value"]))
        self.valid += 1
        self.total += value
        self.low = value if self.low is None else min(self.low, value)
        self.high = value if self.high is None else max(self.high, value)

    def row(self, station, indicator, year, month):
        if len(self.units) > 1:
            raise RefineStoreError("AIR_UNIT_MISMATCH")
        start = datetime(year, month, 1, tzinfo=KST)
        end = datetime(year + month // 12, month % 12 + 1, 1, tzinfo=KST)
        hours = int((end - start).total_seconds()) // 3600
        # 유효 시간이 그 달 시간의 75% 미만이면 월평균을 내지 않는다
        mean = self.total / self.valid if self.valid and self.valid * 4 >= hours * 3 else None
        name = max(self.names) if self.names else None  # 그 달에 이름이 바뀌면 사전순 뒤의 것
        unit = next(iter(self.units), None)
        return [
            station,
            name,
            indicator,
            unit,
            start,
            end,
            hours,
            self.valid,
            self.held,
            mean,
            self.low,
            self.high,
            self.provisional,
        ]


def _month_key(r):
    """(측정소, 지표, 연, 월). 시간값이 아니거나 칸을 읽을 수 없으면 None."""
    station, indicator = r.get("place_code_raw"), r.get("indicator_id")
    if r.get("observed_period_type") != "H" or not station or not indicator:
        return None
    try:
        start = datetime.fromisoformat(r["observed_period_start"])
    except (KeyError, TypeError, ValueError):
        return None
    if start.tzinfo is None:
        return None
    local = start.astimezone(KST)
    return station, indicator, local.year, local.month
