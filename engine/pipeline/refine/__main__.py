"""정제 실행.

python -m pipeline.refine <C1 레코드 JSON 배열 파일> → 정제 레코드 JSONL (stdout)
python -m pipeline.refine --db
    → DB 의 장부(raw_record.c1_record)를 정제해 normalized_record 에 저장, 건수 JSON (stdout)
"""

import json
import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .run import refine_records
from .serialize import dumps_record
from .store import RefineStoreError, refine_raw

ROOT = Path(__file__).resolve().parents[3]
USAGE = "사용법: python -m pipeline.refine <C1 레코드 JSON 배열 파일> | --db"


def connect_from_env():
    """수집기와 같은 루트 .env 의 DB 칸을 쓴다. 값은 출력하지 않는다."""
    config = dotenv_values(ROOT / ".env", interpolate=False)
    if not config.get("DB_PASSWORD"):
        raise RefineStoreError("DB_PASSWORD_MISSING")
    return psycopg.connect(
        host=config.get("POSTGRES_HOST") or "localhost",
        port=config.get("POSTGRES_PORT") or "5432",
        dbname=config.get("DB_NAME") or "issue_atlas",
        user=config.get("DB_USERNAME") or "postgres",
        password=config["DB_PASSWORD"],
        connect_timeout=5,
        autocommit=True,
    )


def main(argv: list[str], connect=connect_from_env) -> int:
    if argv == ["--db"]:
        return _db(connect)
    if len(argv) != 1:
        print(USAGE, file=sys.stderr)
        return 2
    records = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    # Windows 에서도 줄바꿈이 \r\n 으로 바뀌지 않게 바이트로 쓴다
    out = sys.stdout.buffer
    for refined in refine_records(records):
        out.write(dumps_record(refined).encode("utf-8") + b"\n")
    return 0


def _db(connect) -> int:
    try:
        with connect() as conn:
            stats = refine_raw(conn)
    except RefineStoreError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except psycopg.Error:
        # DSN·SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("REFINE_DB_ERROR", file=sys.stderr)
        return 1
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
