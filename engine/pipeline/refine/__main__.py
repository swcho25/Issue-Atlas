"""정제 실행.

python -m pipeline.refine <C1 레코드 JSON 배열 파일> → 정제 레코드 JSONL (stdout)
python -m pipeline.refine --db
    → DB 의 장부(raw_record.c1_record)를 정제해 normalized_record 에 저장, 건수 JSON (stdout)
python -m pipeline.refine --db --source <출처> [--source <출처> ...]
    → 그 출처의 장부만 정제한다(예: press_gwangju 는 1분 안, 전체는 약 40분)
python -m pipeline.refine --db --changed-since <ISO 시각>
    → 그 시각 뒤에 수집 실행 이력(job_run)이 생긴 출처만. 서버 실행기가 수집 뒤에 부른다
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .run import refine_records
from .serialize import dumps_record
from .store import RefineStoreError, changed_sources, refine_raw

ROOT = Path(__file__).resolve().parents[3]
USAGE = (
    "사용법: python -m pipeline.refine <C1 레코드 JSON 배열 파일>"
    " | --db [--source <출처> ... | --changed-since <ISO 시각>]"
)


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


def _instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("시간대가 없는 시각")
    return parsed


def _parse(argv: list[str]):
    p = argparse.ArgumentParser(add_help=False, exit_on_error=False)
    p.add_argument("file", nargs="?")
    p.add_argument("--db", action="store_true")
    p.add_argument("--source", action="append")
    p.add_argument("--changed-since", type=_instant)
    try:
        args, rest = p.parse_known_args(argv)
    except argparse.ArgumentError:
        return None
    scoped = args.source is not None or args.changed_since is not None
    if rest or (args.file is None) == (not args.db) or (scoped and not args.db):
        return None
    if args.source is not None and args.changed_since is not None:
        return None
    return args


def main(argv: list[str], connect=connect_from_env) -> int:
    args = _parse(argv)
    if args is None:
        print(USAGE, file=sys.stderr)
        return 2
    if args.db:
        return _db(connect, args.source, args.changed_since)
    records = json.loads(Path(args.file).read_text(encoding="utf-8"))
    # Windows 에서도 줄바꿈이 \r\n 으로 바뀌지 않게 바이트로 쓴다
    out = sys.stdout.buffer
    for refined in refine_records(records):
        out.write(dumps_record(refined).encode("utf-8") + b"\n")
    return 0


def _db(connect, sources=None, since=None) -> int:
    try:
        with connect() as conn:
            if since is not None:
                sources = changed_sources(conn, since)
            stats = refine_raw(conn, sources)
            if sources is not None:
                stats["sources"] = sorted(sources)
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
