"""빅카인즈 뉴스 검색(여수·광주) → 기사마다 원문 본문 수집 → raw_record 한 행 + 장부(C1 기사 칸).

python -m pipeline.collect.bigkinds --start 2025-01-01 --until 2025-01-08
    → raw_record 저장, 건수 JSON (stdout). --until 은 그날을 넣지 않는다(기본: 오늘, 한국 날짜)

빅카인즈 OpenAPI newstore v1.0 뉴스 검색. 요청 fields 에 provider_link_page · content 를 넣는다
(content = 본문 앞 200자로 원문 페이지가 같은 기사인지 본다, pipeline.article).
본문은 언론사 원문 페이지에서 받고 내부 분석(요약·분류)에만 쓴다. 본문 저장은 팀·멘토 확인 전이다.
"""

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import unquote
from urllib.request import Request, build_opener
from uuid import uuid4

import psycopg
from dotenv import dotenv_values

from pipeline.article.run import fetch_articles
from pipeline.refine.validate import validate

from .airkorea import KST
from .kosis import MAX_BYTES, CollectionError, NoRedirect, canonical
from .store import PostgresStore

ROOT = Path(__file__).resolve().parents[3]
ENDPOINT = "https://tools.kinds.or.kr/search/news"
QUERY = "여수 OR 광주"
FIELDS = (
    "news_id",
    "title",
    "published_at",
    "provider",
    "category",
    "provider_link_page",
    "content",
)
PAGE_SIZE = 100
MAX_DAYS = 31
# ponytail: 실행마다 검색 호출 상한만 둔다. 하루 호출량(PRD: 할당량의 80%) 합산은 할당량이 정해지면
MAX_CALLS = 200
SAVE_EVERY = 50  # 본문 수집은 기사마다 1초 이상이라 이만큼씩 저장해 멈춰도 앞 기사는 남긴다


@dataclass(frozen=True)
class NewsQuery:
    source_id: ClassVar[str] = "bigkinds"
    spec_id: ClassVar[str] = "bigkinds_news_yeosu_gwangju"
    source_name: ClassVar[str] = "빅카인즈 뉴스"
    source_org: ClassVar[str] = "한국언론진흥재단"
    license_type: ClassVar[str] = "BIGKINDS-이용약관"
    source_scope: ClassVar[str] = "metadata"  # P2 이용허락 표. 기사 행은 본문이 있으면 full
    evidence_class: ClassVar[str] = "documents"
    method: ClassVar[str] = "api"
    collector_version: ClassVar[str] = "bigkinds-0.2.0"
    start: date
    until: date

    def identity(self):
        return {
            "endpoint": ENDPOINT,
            "query": QUERY,
            "fields": list(FIELDS),
            "page_size": PAGE_SIZE,
        }

    def run_params(self):
        return {"start": self.start.isoformat(), "until": self.until.isoformat()}


def fetch_page(day: date, offset: int, api_key: str) -> tuple[list[dict], int]:
    """하루(한국 날짜) 검색 결과의 한 쪽 → (documents, total_hits)."""
    body = {
        "access_key": api_key,
        "argument": {
            "query": QUERY,
            "published_at": {"from": day.isoformat(), "until": (day + timedelta(1)).isoformat()},
            "sort": {"date": "asc"},
            "return_from": offset,
            "return_size": PAGE_SIZE,
            "fields": list(FIELDS),
        },
    }
    request = Request(
        ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as response:
            raw = response.read(MAX_BYTES + 1)
    except HTTPError as exc:
        raise CollectionError(f"BIGKINDS_HTTP_{exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise CollectionError("BIGKINDS_NETWORK_ERROR") from None
    if len(raw) > MAX_BYTES:
        raise CollectionError("BIGKINDS_RESPONSE_TOO_LARGE")
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeError, ValueError):
        raise CollectionError("BIGKINDS_INVALID_RESPONSE") from None
    if api_key and api_key in unquote(json.dumps(data, ensure_ascii=False)):
        raise CollectionError("BIGKINDS_SECRET_IN_RESPONSE")
    try:
        if data["result"] != 0:
            raise CollectionError("BIGKINDS_API_ERROR")
        found = data["return_object"]
        rows, total = found["documents"], found["total_hits"]
        if type(total) is not int or not isinstance(rows, list) or len(rows) > PAGE_SIZE:
            raise ValueError
        if any(not isinstance(r, dict) for r in rows):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise CollectionError("BIGKINDS_INVALID_RESPONSE") from None
    return rows, total


def search(query: NewsQuery, api_key: str, fetch=fetch_page) -> tuple[list[dict], int]:
    """기간의 모든 기사(같은 news_id 는 처음 것) → (documents, 검색 호출 수)."""
    documents, calls = {}, 0
    day = query.start
    while day < query.until:
        offset = 0
        while True:
            calls += 1
            if calls > MAX_CALLS:
                raise CollectionError("BIGKINDS_CALL_LIMIT")
            rows, total = fetch(day, offset, api_key)
            for row in rows:
                if not isinstance(row.get("news_id"), str) or not row["news_id"]:
                    raise CollectionError("BIGKINDS_INVALID_DOCUMENT")
                documents.setdefault(row["news_id"], {f: row.get(f) for f in FIELDS})
            offset += len(rows)
            if not rows or offset >= total:
                break
        day += timedelta(1)
    return list(documents.values()), calls


def to_record(document: dict, result: dict, run_id: str, at: str) -> tuple[dict, dict]:
    """빅카인즈 기사 + 본문 수집 결과 → (원본 payload, C1 기사 레코드)."""
    fetch = {k: result[k] for k in ("status", "http_status", "fetched_at", "fetcher")}
    body = result["body"]
    payload = {"bigkinds": document, "article": fetch | {"url": result["url"], "body": body}}
    # 요청 시각은 지문에서 뺀다. 같은 기사 · 같은 결과를 다시 받으면 같은 원본이다
    fingerprint = {"source_id": NewsQuery.source_id, "bigkinds": document, "body": body}
    fingerprint |= {"status": fetch["status"], "http_status": fetch["http_status"]}
    category = document.get("category")
    record = {
        "source_id": NewsQuery.source_id,
        "spec_id": NewsQuery.spec_id,
        "raw_url": ENDPOINT,
        "file_name": None,
        "content_hash": "sha256:" + hashlib.sha256(canonical(fingerprint).encode()).hexdigest(),
        "collected_at": at,
        "published_at": document.get("published_at"),
        "observed_at": None,
        "observed_at_source": None,
        "observed_period_type": "none",
        "observed_period_start": None,
        "observed_period_end": None,
        "place_code_raw": QUERY,  # 기사 지명이 아니라 수집 검색어. P2 는 빈 칸을 누락으로 본다
        "place_code_system": "source_text",
        "place_id": None,
        "place_map_status": "unmapped",
        "geometry": None,
        "location_precision": "none",
        "geometry_role": None,
        "indicator_id": None,
        "value": None,
        "unit": None,
        "missing_reason": None,
        "is_provisional": False,
        "locator": {"news_id": document["news_id"]},
        # 실패한 뒤 다시 받아 성공하면 다른 레코드다. 같은 결과의 반복만 같은 키
        "dedup_key": f"bigkinds:{document['news_id']}:{fetch['status']}",
        "license_type": NewsQuery.license_type,
        "storage_scope": "full" if body else "metadata",
        "run_id": run_id,
        "collector_version": NewsQuery.collector_version,
        "document": {
            "kind": "news",
            "title": document.get("title"),
            "publisher": document.get("provider") or None,
            # 빅카인즈는 분류가 없으면 빈 문자열을 넣기도 한다
            "categories": list(dict.fromkeys(c for c in category or [] if c)),
            "keywords": [],
            "entities": {"locations": [], "persons": [], "organizations": []},
            "excerpt": None,
            "link": result["url"],
            "fetch": fetch,
            "body": body,
        },
    }
    return payload, record


class NewsStore(PostgresStore):
    def fetched(self, news_ids: list[str]) -> set[str]:
        """이미 본문을 받은(ok) 기사. 다시 요청하지 않는다."""
        rows = self.conn.execute(
            "SELECT c1_record->'locator'->>'news_id' FROM raw_record WHERE spec_id = %s"
            " AND c1_record->'document'->'fetch'->>'status' = 'ok'"
            " AND c1_record->'locator'->>'news_id' = ANY(%s)",
            (NewsQuery.spec_id, news_ids),
        )
        return {row[0] for row in rows}


def collect(query: NewsQuery, api_key: str, store, *, fetch=fetch_page, **article_options):
    """검색 → 본문 수집 → SAVE_EVERY 건씩 저장. article_options 는 fetch_articles 로(테스트)."""
    run_id = "bigkinds_" + uuid4().hex
    at = datetime.now(UTC).isoformat()
    store.start(query, run_id, at)
    stats = {"received": 0, "skipped": 0, "inserted": 0, "duplicates": 0, "calls": 0}
    stats |= query.run_params()  # finish 가 stats 를 통째로 바꾸므로 기간도 함께 둔다
    status_counts = {}
    try:
        if not api_key:
            raise CollectionError("BIGKINDS_KEY_MISSING")
        documents, stats["calls"] = search(query, api_key, fetch)
        stats["received"] = len(documents)
        done = store.fetched([d["news_id"] for d in documents])
        stats["skipped"] = len(done)
        todo = [d for d in documents if d["news_id"] not in done]
        by_id = {d["news_id"]: d for d in todo}
        rows, records = [], []

        def flush():
            try:
                saved = store.save(rows, records)
            except Exception:
                raise CollectionError("DB_WRITE_FAILED") from None
            stats["inserted"] += saved
            stats["duplicates"] += len(records) - saved
            rows.clear()
            records.clear()

        for result in fetch_articles(todo, **article_options):
            payload, record = to_record(by_id[result["news_id"]], result, run_id, at)
            if validate(record):
                raise CollectionError("C1_INTAKE_VALIDATION_FAILED")
            rows.append(payload)
            records.append(record)
            status_counts[result["status"]] = status_counts.get(result["status"], 0) + 1
            if len(records) >= SAVE_EVERY:
                flush()
        flush()
    except BaseException as exc:
        status = "aborted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed"
        code = str(exc) if isinstance(exc, CollectionError) else "BIGKINDS_COLLECTION_FAILED"
        store.finish(run_id, status, stats | {"fetch_status": status_counts, "error_code": code})
        raise CollectionError(code) from None
    stats["fetch_status"] = dict(sorted(status_counts.items()))
    store.finish(run_id, "ok", stats)
    return {"run_id": run_id, **stats}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--start", type=date.fromisoformat, required=True)
    p.add_argument("--until", type=date.fromisoformat)
    args = p.parse_args(argv)
    today = datetime.now(KST).date()
    until = args.until or today
    try:
        # 끝나지 않은 오늘은 받지 않는다(기사가 더 올라온다)
        if not args.start < until <= today or (until - args.start).days > MAX_DAYS:
            raise CollectionError("BIGKINDS_INVALID_DATE_RANGE")
        config = dotenv_values(ROOT / ".env", interpolate=False)
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
            query = NewsQuery(args.start, until)
            result = collect(query, config.get("BIGKINDS_API_KEY") or "", NewsStore(conn))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except CollectionError as exc:
        print(str(exc), file=sys.stderr)
    except Exception:
        # DSN · 요청 URL · 응답 본문이 담길 수 있는 예외 문구는 출력하지 않는다
        print("BIGKINDS_CONFIGURATION_OR_IO_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
