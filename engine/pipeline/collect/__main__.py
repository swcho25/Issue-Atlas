"""python -m pipeline.collect --spec-id SP01|SP02|SP10 [--fixture <원천 JSON> --export-only]."""

import argparse
import json
import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .kosis import REGIONS, TABLES, CollectionError, Query
from .run import collect
from .store import PostgresStore

ROOT = Path(__file__).resolve().parents[3]


class ExportOnlyStore:
    """원천 파일의 C1·P2 호환성 검사 전용. DB 저장 성공으로 표시하지 않는다."""

    def start(self, *args):
        pass

    def save(self, rows, records):
        return 0

    def finish(self, *args):
        pass


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--indicator-id", help="기본값: 표의 지표 ID (C1 indicators.json)")
    p.add_argument("--source-id", default="S01")
    p.add_argument("--spec-id", choices=TABLES, default="SP01")
    p.add_argument("--start-year", type=int, default=2023)
    p.add_argument("--end-year", type=int, default=2025)
    p.add_argument("--regions", nargs="+", choices=REGIONS, default=list(REGIONS))
    p.add_argument("--output", type=Path, default=ROOT / "outputs/collect/kosis-c1.json")
    p.add_argument("--fixture", type=Path, help="기존 원천 응답 배열. 네트워크 호출 없음")
    p.add_argument(
        "--export-only", action="store_true", help="fixture의 C1 출력만 확인. DB 사용 안 함"
    )
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        table = TABLES[args.spec_id]
        query = Query(
            args.indicator_id or table.indicator_id,
            args.start_year,
            args.end_year,
            tuple(args.regions),
            args.source_id,
            args.spec_id,
            table,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        fetch_options = {}
        if args.fixture:
            fixture = json.loads(args.fixture.read_text(encoding="utf-8-sig"))
            if not isinstance(fixture, list):
                raise CollectionError("INVALID_FIXTURE")

            def fetch_fixture(query, region, api_key):
                return [r for r in fixture if isinstance(r, dict) and r.get("C1") == region]

            fetch_options["fetch"] = fetch_fixture
        if args.export_only:
            api_key = (
                "fixture"
                if args.fixture
                else (dotenv_values(ROOT / ".env", interpolate=False).get("KOSIS_API_KEY") or "")
            )
            collect(query, api_key, ExportOnlyStore(), args.output, **fetch_options)
            print(json.dumps({"mode": "export_only", "db_written": False}))
            return 0
        # 파일의 값을 출력하지 않는다. API 키의 환경 변수/인자 주입도 받지 않는다.
        config = dotenv_values(ROOT / ".env", interpolate=False)
        api_key = config.get("KOSIS_API_KEY") or ""
        # 기존 JDBC DB_URL은 Python DSN과 다르다. 구성 요소를 별도 인자로 전달한다.
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
            result = collect(query, api_key, PostgresStore(conn), args.output, **fetch_options)
        print(json.dumps(result))
        return 0
    except CollectionError as exc:
        print(str(exc), file=sys.stderr)
    except Exception:
        # DB DSN/요청 URL/응답 본문이 포함될 수 있는 예외·traceback은 출력하지 않는다.
        print("COLLECTOR_CONFIGURATION_OR_IO_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
