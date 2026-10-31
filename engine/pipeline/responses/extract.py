"""온통청년 정책 · 지방재정365 세출 → 카드 근거 ③ 「기존 대응」 후보(existing_response, V0018).

python -m pipeline.responses --db   → 건수 JSON (stdout)

원천 칸을 그대로 옮기는 규칙만 쓴다(extracted_by = rule). 선정은 후보일 뿐이다 —
키워드 · 주관기관으로 고르되 지역 · 기간 · 효과를 확정하지 않는다.
계약: contracts/existing-response/README.md (S15P31C108-136)
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import date, timedelta

import psycopg
from psycopg.types.json import Jsonb

from pipeline.collect.lofin import connect_from_env

RULE_VERSION = "existing-0.1"
# 온통청년 조회 지역(새 법정 시군구 코드) → 그 시 · 구 이름. 조회 지역에는 중앙부처 ·
# 다른 지역 정책도 섞여 온다. 주관기관이 이 시 · 구 자신(통합 전후 광역 이름 + 시 · 구 이름)인
# 정책만 고른다
ISSUERS = {
    "12130": "여수시",
    "12210": "동구",
    "12240": "서구",
    "12270": "남구",
    "12300": "북구",
    "12330": "광산구",
}
PROVINCES = r"(?:전남광주통합특별시|광주광역시|전라남도)"
# 세출 사업명 → 카드. 「대기」 하나만 보면 「확대기반」도 걸려 붙은 말로만 고른다
KEYWORDS = {
    "C1": re.compile(r"청년"),
    "A3": re.compile(
        r"미세먼지|비산먼지|대기(?:오염|환경|질|배출|측정|장비|[·ㆍ])|배출가스|저공해"
    ),
}
YMD = re.compile(r"\d{8}")

YOUTH = """
SELECT r.content_hash, r.payload, n.place_code_raw, m.place_id
FROM normalized_ready n
JOIN raw_record r USING (content_hash)
LEFT JOIN place_code_map m ON m.code_system = 'kosis' AND m.place_code = n.place_code_raw
WHERE n.source_id = 'youthcenter'
"""
LOFIN = """
SELECT e.expenditure_id, e.fiscal_year, e.place_code_raw, m.place_id, e.project_name
FROM local_expenditure e
LEFT JOIN place_code_map m ON m.code_system = 'kosis' AND m.place_code = e.place_code_raw
"""
COLUMNS = (
    "response_id",
    "card_id",
    "origin",
    "origin_ref",
    "raw_content_hash",
    "expenditure_id",
    "place_code_raw",
    "place_id",
    "name",
    "department",
    "fiscal_year",
    "period_start",
    "period_end",
    "target",
    "field_sources",
    "extracted_by",
    "selection_reason",
    "rule_version",
)


def _id(card: str, origin: str, version: str) -> str:
    return "resp:" + hashlib.sha256(f"{card}|{origin}|{version}".encode()).hexdigest()


def _text(value) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _ymd(value) -> date | None:
    text = _text(value)
    if not text or not YMD.fullmatch(text):
        return None
    try:
        return date(int(text[:4]), int(text[4:6]), int(text[6:]))
    except ValueError:
        return None


def _age(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def from_policy(content_hash: str, payload: dict, code: str, place_id: str | None) -> dict | None:
    """온통청년 정책 한 건(조회 지역 code) → C1 후보. 주관기관이 그 시 · 구가 아니면 None."""
    row = payload["youthcenter"]
    issuer = _text(row.get("sprvsnInstCdNm"))
    name = ISSUERS.get(code)
    if not issuer or not name or not re.match(rf"{PROVINCES} {name}(?: |$)", issuer):
        return None
    start, end = _ymd(row.get("bizPrdBgngYmd")), _ymd(row.get("bizPrdEndYmd"))
    lo, hi = _age(row.get("sprtTrgtMinAge")), _age(row.get("sprtTrgtMaxAge"))
    # 연령 칸이 0 이면 원천이 연령을 주지 않은 것이다. 자격 문구로 대상을 지어내지 않는다
    target = f"만 {lo}~{hi}세" if 0 < lo <= hi else None
    return {
        "response_id": _id("C1", "youthcenter", content_hash),
        "card_id": "C1",
        "origin": "youthcenter",
        "origin_ref": f"{row['plcyNo']}:{code}",
        "raw_content_hash": content_hash,
        "expenditure_id": None,
        "place_code_raw": code,
        "place_id": place_id,
        "name": row["plcyNm"].strip(),
        "department": issuer,
        "fiscal_year": None,
        "period_start": start,
        # 원천 종료일은 그날 포함 → [start, end)
        "period_end": end + timedelta(days=1) if end and (not start or end >= start) else None,
        "target": target,
        "field_sources": {
            "name": "plcyNm",
            "department": "sprvsnInstCdNm",
            "period": "bizPrdBgngYmd~bizPrdEndYmd" if start or end else None,
            "target": "sprtTrgtMinAge~sprtTrgtMaxAge" if target else None,
            "place": "zipCd(조회 지역)",
        },
        "extracted_by": "rule",
        "selection_reason": f"온통청년 청년정책, 주관기관 「{issuer}」",
        "rule_version": RULE_VERSION,
    }


def from_expenditure(
    expenditure_id: str, year: int, code: str, place_id: str | None, project: str
) -> list[dict]:
    """세출 한 줄 → 사업명 키워드에 걸린 카드마다 후보. 세출에는 부서 · 대상 · 사업 기간이 없다."""
    found = []
    for card, pattern in KEYWORDS.items():
        match = pattern.search(project)
        if not match:
            continue
        found.append(
            {
                "response_id": _id(card, "lofin", expenditure_id),
                "card_id": card,
                "origin": "lofin",
                "origin_ref": expenditure_id,
                "raw_content_hash": None,
                "expenditure_id": expenditure_id,
                "place_code_raw": code,
                "place_id": place_id,
                "name": project,
                "department": None,
                "fiscal_year": year,
                "period_start": None,
                "period_end": None,
                "target": None,
                "field_sources": {
                    "name": "세부사업명",
                    "department": None,
                    "fiscal_year": "회계연도(시트 이름)",
                    "period": None,
                    "target": None,
                    "place": "자치단체",
                },
                "extracted_by": "rule",
                "selection_reason": f"세부사업명에 「{match.group()}」",
                "rule_version": RULE_VERSION,
            }
        )
    return found


INSERT = (
    f"INSERT INTO existing_response ({', '.join(COLUMNS)})"
    f" VALUES ({', '.join(['%s'] * len(COLUMNS))}) ON CONFLICT (response_id) DO NOTHING"
)
# 같은 원천 식별자의 다른 판이 이미 있으면 내용이 바뀐 것이다. 옛 판은 현재가 아니다
SUPERSEDE = """
UPDATE existing_response SET is_current = false
WHERE card_id = %s AND origin = %s AND origin_ref = %s AND response_id <> %s AND is_current
"""


def extract(conn) -> dict:
    """한 트랜잭션. 같은 판은 건너뛰고(unchanged), 바뀐 판은 넣고 옛 판을 내린다(changed)."""
    rows = []
    for content_hash, payload, code, place_id in conn.execute(YOUTH):
        if (row := from_policy(content_hash, payload, code, place_id)) is not None:
            rows.append(row)
    for record in conn.execute(LOFIN):
        rows.extend(from_expenditure(*record))
    stats = {"candidates": len(rows), "inserted": 0, "unchanged": 0, "changed": 0}
    with conn.transaction(), conn.cursor() as cur:
        for row in rows:
            cur.execute(
                INSERT, [Jsonb(row[c]) if c == "field_sources" else row[c] for c in COLUMNS]
            )
            if not cur.rowcount:
                stats["unchanged"] += 1
                continue
            stats["inserted"] += 1
            key = (row["card_id"], row["origin"], row["origin_ref"], row["response_id"])
            cur.execute(SUPERSEDE, key)
            stats["changed"] += cur.rowcount > 0
    by_card = conn.execute(
        "SELECT card_id, origin, count(*) FROM existing_response WHERE is_current"
        " GROUP BY 1, 2 ORDER BY 1, 2"
    ).fetchall()
    stats["current"] = {f"{card}/{origin}": n for card, origin, n in by_card}
    return stats


def main(argv=None, connect=connect_from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--db", action="store_true", required=True)
    p.parse_args(argv)
    try:
        with connect() as conn:
            print(json.dumps(extract(conn), ensure_ascii=False))
        return 0
    except psycopg.Error:
        # DSN · SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("RESPONSES_DB_ERROR", file=sys.stderr)
    except Exception:
        print("RESPONSES_FAILED", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
