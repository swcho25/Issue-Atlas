"""python -m pipeline.collect.airkorea_cli stations|final [옵션]."""

import argparse
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

import psycopg
from dotenv import dotenv_values

from pipeline.refine.run import refine_record

from .__main__ import ROOT, ExportOnlyStore
from .airkorea import AirSpec, area_of, station_pairs, workbook_pairs
from .kosis import CollectionError
from .run import write_records
from .store import PostgresStore

MAX_RECORDS = 100000


def execute(spec, store, output, loader):
    run_id = "airkorea_" + uuid4().hex
    at = datetime.now(UTC).isoformat()
    store.start(spec, run_id, at)
    stats = {"received": 0, "inserted": 0, "duplicates": 0}
    try:
        rows, records, seen = [], [], {}
        for payload, record in loader(spec, run_id, at):
            key = record["dedup_key"]
            if key in seen:
                if seen[key] == record["content_hash"]:
                    continue
                raise CollectionError("AIRKOREA_CONFLICTING_OBSERVATION")
            seen[key] = record["content_hash"]
            if len(records) >= MAX_RECORDS:
                raise CollectionError("AIRKOREA_BATCH_TOO_LARGE")
            if refine_record(record)["validation_status"] != "pass":
                raise CollectionError("C1_P2_VALIDATION_FAILED")
            rows.append(payload)
            records.append(record)
        stats["received"] = len(records)
        if not records:
            raise CollectionError("AIRKOREA_NO_TARGET_DATA")
        try:
            stats["inserted"] = store.save(rows, records)
        except Exception:
            raise CollectionError("DB_WRITE_FAILED") from None
        stats["duplicates"] = len(records) - stats["inserted"]
        try:
            write_records(output, records)
        except OSError:
            raise CollectionError("C1_EXPORT_FAILED") from None
    except BaseException as exc:
        code = str(exc) if isinstance(exc, CollectionError) else "AIRKOREA_COLLECTION_FAILED"
        status = "aborted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed"
        store.finish(run_id, status, stats | {"error_code": code})
        raise CollectionError(code) from None
    store.finish(run_id, "ok", stats)
    return {"run_id": run_id, **stats}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("stations", "final"))
    parser.add_argument("--xlsx", type=Path)
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2024, 1, 1))
    parser.add_argument("--end-date", type=date.fromisoformat, default=date(2024, 1, 2))
    parser.add_argument("--fixture", type=Path, help="측정소 API 원천 배열, 네트워크 호출 없음")
    parser.add_argument(
        "--stations", type=Path, help="명시적으로 좌표를 연결할 C1 측정소 메타 파일"
    )
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    if args.mode == "final" and not args.xlsx:
        parser.error("final에는 --xlsx가 필요합니다")
    if args.mode == "final" and args.fixture:
        parser.error("--fixture는 stations에서만 사용합니다")
    if args.mode == "stations" and (args.xlsx or args.stations):
        parser.error("stations에는 --xlsx/--stations를 사용하지 않습니다")
    try:
        spec = AirSpec(
            args.mode, args.start_date, args.end_date, args.xlsx.name if args.xlsx else None
        )
        output = args.output or ROOT / f"outputs/collect/airkorea-{args.mode}-c1.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        config = {}
        if not args.export_only or (args.mode == "stations" and not args.fixture):
            config = dotenv_values(ROOT / ".env", interpolate=False)
        if args.mode == "stations":
            if args.fixture:
                fixture = json.loads(args.fixture.read_text(encoding="utf-8-sig"))
                if not isinstance(fixture, list) or any(not isinstance(r, dict) for r in fixture):
                    raise CollectionError("AIRKOREA_INVALID_FIXTURE")

                def fetch_fixture(area, page, key):
                    selected = [r for r in fixture if area_of(r.get("addr", "")) == area]
                    return selected[(page - 1) * 100 : page * 100], len(selected)

                def loader(spec, run, at):
                    return station_pairs(spec, run, at, "fixture", fetch=fetch_fixture)
            else:
                api_key = config.get("AIRKOREA_SERVICE_KEY") or ""

                def loader(spec, run, at):
                    return station_pairs(spec, run, at, api_key)
        else:
            stations = []
            if args.stations:
                stations = json.loads(args.stations.read_text(encoding="utf-8"))
                if not isinstance(stations, list) or any(
                    not isinstance(s, dict) or refine_record(s)["validation_status"] != "pass"
                    for s in stations
                ):
                    raise CollectionError("AIRKOREA_INVALID_STATION_FILE")

            def progress(sheet, scanned):
                print(
                    json.dumps({"sheet": sheet, "scanned": scanned}, ensure_ascii=True),
                    file=sys.stderr,
                    flush=True,
                )

            def loader(spec, run, at):
                return workbook_pairs(args.xlsx, spec, run, at, stations, progress)

        if args.export_only:
            result = execute(spec, ExportOnlyStore(), output, loader)
            result = {"mode": "export_only", "db_written": False, "records": result["received"]}
        else:
            if not config.get("DB_PASSWORD"):
                raise CollectionError("DB_PASSWORD_MISSING")
            with psycopg.connect(
                host=config.get("POSTGRES_HOST") or "localhost",
                port=config.get("POSTGRES_PORT") or "5432",
                dbname=config.get("DB_NAME") or "issue_atlas",
                user=config.get("DB_USERNAME") or "postgres",
                password=config["DB_PASSWORD"],
                connect_timeout=5,
                autocommit=True,
            ) as conn:
                result = execute(spec, PostgresStore(conn), output, loader)
        print(json.dumps(result))
        return 0
    except CollectionError as exc:
        print(str(exc), file=sys.stderr)
    except Exception:
        print("AIRKOREA_CONFIGURATION_OR_IO_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
