"""지방재정365 세부사업별 세출현황(XLSX) → 광주 본청 · 5구 · 여수시 행 → local_expenditure(V0015).

python -m pipeline.collect.lofin --xlsx 2025_세부사업별세출현황.xlsx
    → 행마다 JSONL (stdout), 건수 JSON (stderr). DB 에 쓰지 않는다
python -m pipeline.collect.lofin --xlsx 2025_세부사업별세출현황.xlsx --db
    → local_expenditure 저장, 건수 JSON (stdout)

원천: 지방재정365 통합자료실 「N 회계연도 세부사업별 세출 현황」 첨부(행정안전부,
공공데이터포털 「이용허락범위 제한 없음」). 파일 하나가 한 해, 시트 하나에 전국 약 48만 행.
집행일자는 그해 12월 31일.
"""

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import openpyxl
import psycopg
from dotenv import dotenv_values

from .kosis import CollectionError, canonical

ROOT = Path(__file__).resolve().parents[3]
COLLECTOR = "lofin-0.1.0"
LICENSE = "공공데이터-이용허락범위제한없음"
# (지역, 자치단체) → KOSIS 옛 지역 코드. 광주 본청은 시 전체(보도자료 press_release 와 같은 29)
GOVERNMENTS = {
    ("광주", "본청"): "29",
    ("광주", "동구"): "29110",
    ("광주", "서구"): "29140",
    ("광주", "남구"): "29155",
    ("광주", "북구"): "29170",
    ("광주", "광산구"): "29200",
    ("전남", "여수시"): "46130",
}
HEADER = (
    ("지역", "자치단체", "회계", "세부사업명", "예산현액", None, None, None, None)
    + ("지출액", "집행잔액", "분야", "부문"),
    (None, None, None, None, "계", "국비", "시도비", "시군구비", "기타", None, None, None, None),
)
AMOUNTS = (
    "budget_total",
    "budget_national",
    "budget_province",
    "budget_local",
    "budget_other",
    "expenditure",
    "balance",
)


def _amount(value) -> int:
    # 원 단위 정수. 엑셀이 실수로 줘도 소수점이 없으면 받는다
    if isinstance(value, bool) or not isinstance(value, int | float) or value != int(value):
        raise CollectionError("LOFIN_INVALID_ROW")
    return int(value)


def _text(value) -> str | None:
    return (value.strip() or None) if isinstance(value, str) else None


def read_rows(path: Path, now: str) -> tuple[list[dict], dict]:
    """대상 자치단체 행 → (레코드, 건수). 머리글 · 연도가 다르면 멈춘다."""
    try:
        book = openpyxl.load_workbook(path, read_only=True)
    except Exception:
        raise CollectionError("LOFIN_UNREADABLE_FILE") from None
    try:
        if len(book.worksheets) != 1 or not book.worksheets[0].title.isdigit():
            raise CollectionError("LOFIN_UNEXPECTED_SHEETS")
        sheet = book.worksheets[0]
        year = int(sheet.title)
        rows = sheet.iter_rows(values_only=True)
        next(rows, None)  # 「단위:원」
        if (next(rows, None), next(rows, None)) != HEADER:
            raise CollectionError("LOFIN_HEADER_CHANGED")
        records, counts = {}, {"scanned": 0, "matched": 0, "same_row": 0}
        for row in rows:
            counts["scanned"] += 1
            code = GOVERNMENTS.get((row[0], row[1]))
            if code is None:
                continue
            counts["matched"] += 1
            record = _record(year, row, code, path.name, now)
            # 13칸이 모두 같은 줄은 같은 행으로 본다(원천 안의 완전 중복)
            if record["expenditure_id"] in records:
                counts["same_row"] += 1
            records[record["expenditure_id"]] = record
        if not counts["matched"]:
            raise CollectionError("LOFIN_NO_ROWS")
        return list(records.values()), counts
    finally:
        book.close()


def _record(year: int, row: tuple, code: str, file_name: str, now: str) -> dict:
    if len(row) != 13 or not _text(row[2]) or not _text(row[3]):
        raise CollectionError("LOFIN_INVALID_ROW")
    amounts = dict(zip(AMOUNTS, (_amount(v) for v in row[4:11]), strict=True))
    fingerprint = canonical({"fiscal_year": year, "row": [str(v) for v in row]})
    return {
        "expenditure_id": "sha256:" + hashlib.sha256(fingerprint.encode()).hexdigest(),
        "fiscal_year": year,
        "region": row[0],
        "government": row[1],
        "place_code_raw": code,
        "account": _text(row[2]),
        "project_name": _text(row[3]),
        **amounts,
        "field": _text(row[11]),
        "sector": _text(row[12]),
        "file_name": file_name,
        "license_type": LICENSE,
        "storage_scope": "full",
        "collected_at": now,
        "collector": COLLECTOR,
    }


COLUMNS = (
    "expenditure_id",
    "fiscal_year",
    "region",
    "government",
    "place_code_raw",
    "account",
    "project_name",
    *AMOUNTS,
    "field",
    "sector",
    "file_name",
    "license_type",
    "storage_scope",
    "collected_at",
    "collector",
)
INSERT = (
    f"INSERT INTO local_expenditure ({', '.join(COLUMNS)})"
    f" VALUES ({', '.join(['%s'] * len(COLUMNS))}) ON CONFLICT (expenditure_id) DO NOTHING"
)


def store(conn, records: list[dict]) -> dict:
    """한 트랜잭션. 같은 행을 다시 넣으면 건너뛴다."""
    inserted = 0
    with conn.transaction(), conn.cursor() as cur:
        for record in records:
            cur.execute(INSERT, [record[c] for c in COLUMNS])
            inserted += cur.rowcount
    return {"inserted": inserted, "duplicates": len(records) - inserted}


def connect_from_env():
    """수집기 · 정제와 같은 루트 .env 의 DB 칸을 쓴다. 값은 출력하지 않는다."""
    config = dotenv_values(ROOT / ".env", interpolate=False)
    if not config.get("DB_PASSWORD"):
        raise CollectionError("DB_PASSWORD_MISSING")
    return psycopg.connect(
        host=config.get("POSTGRES_HOST") or "localhost",
        port=config.get("POSTGRES_PORT") or "5432",
        dbname=config.get("DB_NAME") or "issue_atlas",
        user=config.get("DB_USERNAME") or "postgres",
        password=config["DB_PASSWORD"],
        connect_timeout=5,
        autocommit=True,
    )


def main(argv=None, connect=connect_from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--xlsx", type=Path, required=True)
    p.add_argument("--db", action="store_true")
    args = p.parse_args(argv)
    now = datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    try:
        records, counts = read_rows(args.xlsx, now)
        if args.db:
            with connect() as conn:
                result = store(conn, records)
            print(json.dumps(counts | result | {"records": len(records)}, ensure_ascii=False))
            return 0
        out = sys.stdout.buffer  # Windows 에서도 \n 만 쓰게 바이트로
        for record in records:
            out.write(json.dumps(record, ensure_ascii=False).encode("utf-8") + b"\n")
        print(json.dumps(counts | {"records": len(records)}), file=sys.stderr)
        return 0
    except CollectionError as exc:
        print(str(exc), file=sys.stderr)
    except psycopg.Error:
        # DSN · SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("LOFIN_DB_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
