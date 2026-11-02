"""지자체 보도자료 게시판 목록 → C1 문서 레코드(kind press_release). 본문은 받지 않는다.

python -m pipeline.collect.press --site yeosu|gwangju [--start 2023-01-01 --end 2025-12-31]
    → 보도자료마다 C1 레코드 JSONL (stdout), 건수 JSON (stderr)
python -m pipeline.collect.press --site yeosu|gwangju --db
    → 원본 장부(raw_record · job_run)에 쪽마다 저장, 건수 JSON (stdout). P2 정제가 이어 받는다
python -m pipeline.collect.press --site gwangju --db --from-table
    → 게시판 대신 옛 보도자료 표(press_release)의 목록을 같은 방식으로 원본 장부에 옮긴다.
    광주 누리집이 2026-11-02 부터 자동 요청을 막아(400) 10/30 에 받은 목록이 유일한 사본이다
--output <파일>: JSONL 을 그 파일에 쓴다 (--db 와 함께면 저장한 레코드의 사본).
    서버 실행기(deploy/collector)가 실행마다 지정한다

여수시 보도자료는 공공누리 4유형(변경금지·상업적 이용금지), 광주광역시는 공공누리 표시가 없다.
P2 이용허락 표(KOGL-4 · KOGL-미표시 → metadata)에 맞춰 목록에 보이는
제목·분류·담당부서·등록일·링크만 둔다. 담당부서는 C1 문서 칸에 없어 원본(payload)에만 남는다.
"""

import argparse
import hashlib
import json
import re
import sys
import time
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import ClassVar
from urllib.parse import parse_qs, urlsplit
from urllib.robotparser import RobotFileParser
from uuid import uuid4
from zoneinfo import ZoneInfo

import lxml.html
import psycopg
from dotenv import dotenv_values

from pipeline.article.fetch import USER_AGENT, Pacer, http_getter
from pipeline.collect.kosis import CollectionError, canonical
from pipeline.collect.store import PostgresStore
from pipeline.refine.validate import validate

ROOT = Path(__file__).resolve().parents[3]
COLLECTOR = "press-0.2.0"
PAGE_SIZE = 100
MIN_INTERVAL = (
    2.0  # robots.txt 에 Crawl-Delay 가 없어도 같은 사이트 요청 사이에 둔다 (PRD 수집 예절)
)
ATTEMPTS = 3
MAX_PAGES = 300  # 여수시 2023–2025 는 약 100쪽. 넘으면 끝을 못 찾은 것으로 보고 멈춘다
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
TIME = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d")


class PressError(Exception):
    """외부 응답·예외 문자열을 포함하지 않는 고정 원인 코드."""


def _text(nodes) -> str:
    # 숨김 글자(<span class="blind">번호</span>)는 빼고 그 칸의 글자만
    return " ".join("".join(t for n in nodes for t in n.xpath("text()")).split())


def _doc(html: bytes):
    # 두 게시판 모두 UTF-8. 바이트를 그대로 주면 meta 가 없을 때 lxml 이 latin-1 로 읽는다
    return lxml.html.fromstring(html.decode("utf-8", errors="replace"))


def _today_kst() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()


def parse_yeosu(html: bytes) -> list[dict]:
    rows = []
    for tr in _doc(html).xpath("//table//tbody/tr"):
        cells = tr.xpath("./td")
        links = tr.xpath("./td//a[contains(@href, 'mode=view')]")
        if len(cells) != 6 or not links:
            continue  # 「등록된 글이 없습니다」 한 칸짜리 줄
        day = _text(cells[4:5])
        rows.append(
            {
                "id": parse_qs(urlsplit(links[0].get("href")).query).get("idx", [""])[0],
                "category": _text(cells[1:2]),
                "title": _text(links),
                "department": _text(cells[3:4]),
                # 오늘 올린 글은 날짜 대신 시각(11:01:13)만 보인다
                "published_on": _today_kst() if TIME.fullmatch(day) else day,
            }
        )
    return rows


def parse_gwangju(html: bytes) -> list[dict]:
    rows = []
    doc = _doc(html)
    for row in doc.xpath("//div[@class='board_list_body']/div[contains(@class, 'body_row')]"):
        links = row.xpath(".//div[@class='subject']//a[@data-seq]")
        if not links:
            continue
        rows.append(
            {
                "id": links[0].get("data-seq"),
                "category": _text(row.xpath("./div[@class='category']")),
                # 목록 글자는 길면 「...」로 잘린다. title 속성이 전체 제목이다
                "title": (links[0].get("title") or "").strip(),
                "department": None,
                "published_on": _text(row.xpath("./div[@class='date']")),
            }
        )
    return rows


@dataclass(frozen=True)
class Site:
    org: str
    place_code_raw: str
    license_type: str
    # 원본의 raw_url. 쪽 번호 · 기간이 없는 게시판 주소라 같은 글은 어느 쪽에서 읽어도 같다
    board_url: str
    list_url: str
    view_url: str
    parse: object
    # 서버가 기간으로 걸러 주지 않으면 최신 글부터 읽다가 시작일보다 오래된 글이 나오면 멈춘다
    server_filter: bool


SITES = {
    "yeosu": Site(
        "여수시",
        "46130",
        "KOGL-4",
        "https://www.yeosu.go.kr/www/govt/news/release/press",
        "https://www.yeosu.go.kr/www/govt/news/release/press?page_scale=100&page={page}",
        "https://www.yeosu.go.kr/www/govt/news/release/press?idx={id}&mode=view",
        parse_yeosu,
        server_filter=False,
    ),
    # 2026-07-01 행정통합 뒤 새 글은 통합특별시 임시 누리집에 있다. 이 게시판은 2026-06-30 까지
    "gwangju": Site(
        "광주광역시",
        "29",
        "KOGL-미표시",
        "https://www.gwangju.go.kr/boardList.do?pageId=www789&boardId=BD_0000000027",
        "https://www.gwangju.go.kr/boardList.do?pageId=www789&boardId=BD_0000000027"
        "&movePage={page}&recordCnt=100&searchSDe={start}&searchEDe={end}",
        "https://www.gwangju.go.kr/boardView.do?pageId=www789&boardId=BD_0000000027&seq={id}",
        parse_gwangju,
        server_filter=True,
    ),
}


@dataclass(frozen=True)
class PressQuery:
    """수집 명세 하나 = 게시판 하나. 이용허락이 달라 출처(source)도 게시판마다 따로 둔다."""

    site: str
    start: date | None = None
    end: date | None = None
    source_scope: ClassVar[str] = "metadata"
    evidence_class: ClassVar[str] = "documents"
    method: ClassVar[str] = "board"
    collector_version: ClassVar[str] = COLLECTOR

    @property
    def source_id(self):
        return f"press_{self.site}"

    @property
    def spec_id(self):
        return f"press_release_{self.site}"

    @property
    def source_name(self):
        return f"{SITES[self.site].org} 보도자료"

    @property
    def source_org(self):
        return SITES[self.site].org

    @property
    def license_type(self):
        return SITES[self.site].license_type

    def identity(self):
        return {"list_url": SITES[self.site].list_url, "page_size": PAGE_SIZE}

    def run_params(self):
        return {"start": self.start.isoformat(), "end": self.end.isoformat()}


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def collect_pages(
    site_name: str,
    start: date,
    end: date,
    *,
    get=None,
    sleep=time.sleep,
    monotonic=time.monotonic,
    now=_utc_now,
):
    """쪽마다 기간 안의 보도자료 레코드 목록을 낸다. 쪽마다 저장하면 멈춰도 앞 쪽은 남는다."""
    site = SITES[site_name]
    get = get or http_getter()
    first = site.list_url.format(page=1, start=start, end=end)
    try:
        status, body = get(_robots_url(first))
    except OSError:
        raise PressError("PRESS_NETWORK_ERROR") from None
    rules = RobotFileParser()
    rules.parse(body.decode("utf-8", errors="replace").splitlines() if status == 200 else [])
    # RFC 9309: 401·403·5xx 는 전부 막힌 것으로 본다
    if status in (401, 403) or status >= 500 or not rules.can_fetch(USER_AGENT, first):
        raise PressError("PRESS_ROBOTS_DISALLOWED")
    pacer = Pacer(max(MIN_INTERVAL, float(rules.crawl_delay(USER_AGENT) or 0)), sleep, monotonic)
    pacer.wait(first)  # robots.txt 요청도 같은 사이트 요청으로 센다
    for page in range(1, MAX_PAGES + 1):
        url = site.list_url.format(page=page, start=start, end=end)
        # 끊김 · 5xx 는 같은 간격을 두고 ATTEMPTS 번까지. 그래도 안 되면 그 쪽에서 멈춘다
        for _ in range(ATTEMPTS):
            pacer.wait(url)
            try:
                status, html = get(url)
            except OSError:
                status, html = None, b""
            if status is not None and status < 500:
                break
        if status is None:
            raise PressError("PRESS_NETWORK_ERROR")
        if status != 200:
            raise PressError(f"PRESS_HTTP_{status}")
        rows = site.parse(html)
        if not rows:
            if page == 1:
                raise PressError("PRESS_NO_ROWS")  # 게시판 모양이 바뀌었을 수 있다
            return
        records = [_record(site_name, site, row, now()) for row in rows]
        yield [r for r in records if start <= date.fromisoformat(r["published_on"]) <= end]
        oldest = min(date.fromisoformat(r["published_on"]) for r in records)
        if len(rows) < PAGE_SIZE or (not site.server_filter and oldest < start):
            return
    raise PressError("PRESS_TOO_MANY_PAGES")


def table_pages(conn, site_name: str, start: date, end: date):
    """옛 보도자료 표(press_release, V0010) → collect_pages 와 같은 쪽 묶음.

    누리집이 자동 요청을 막았을 때(광주, 2026-11-02 부터 400) press-0.1.0 이 받아 둔 목록을 옮긴다.
    보이는 칸이 같아 원본 지문은 다시 수집했을 때와 같고, 수집 시각은 그때 그대로 둔다.
    """
    rows = conn.execute(
        "SELECT press_id, site, category, department, title, published_on, url, collected_at"
        " FROM press_release WHERE site = %s AND published_on BETWEEN %s AND %s"
        " ORDER BY published_on DESC, press_id",
        (site_name, start, end),
    ).fetchall()
    if not rows:
        raise PressError("PRESS_NO_ROWS")
    listings = [
        {
            "press_id": press_id,
            "site": site,
            "category": category,
            "department": department,
            "title": title,
            "published_on": published_on.isoformat(),
            "url": url,
            "collected_at": collected_at.astimezone(UTC)
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z"),
        }
        for press_id, site, category, department, title, published_on, url, collected_at in rows
    ]
    for i in range(0, len(listings), PAGE_SIZE):
        yield listings[i : i + PAGE_SIZE]


def _robots_url(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


def _record(site_name, site, row, collected_at) -> dict:
    if (
        not (row["id"] or "").isdigit()
        or not row["title"]
        or not DATE.fullmatch(row["published_on"])
    ):
        raise PressError("PRESS_UNRECOGNIZED_ROW")
    return {
        "press_id": f"{site_name}:{row['id']}",
        "site": site_name,
        "org": site.org,
        "place_code_raw": site.place_code_raw,
        "category": row["category"] or None,
        "department": row["department"] or None,
        "title": row["title"],
        "published_on": row["published_on"],
        "url": site.view_url.format(id=row["id"]),
        "license_type": site.license_type,
        "storage_scope": "metadata",
        "collected_at": collected_at,
        "collector": COLLECTOR,
    }


# 게시판에서 보이는 칸. 원본(payload)이고, 하나라도 바뀌면 다른 원본 · 다른 판이다
VISIBLE = ("press_id", "category", "department", "title", "published_on", "url")


def to_c1(listing: dict, run_id: str) -> tuple[dict, dict]:
    """목록 한 줄 → (원본 payload, C1 문서 레코드)."""
    site = SITES[listing["site"]]
    payload = {k: listing[k] for k in VISIBLE}
    # 수집 시각은 지문에서 뺀다. 같은 글을 그대로 다시 받으면 같은 원본이다
    digest = hashlib.sha256(canonical(payload).encode()).hexdigest()
    query = PressQuery(listing["site"])
    record = {
        "source_id": query.source_id,
        "spec_id": query.spec_id,
        "raw_url": site.board_url,
        "file_name": None,
        "content_hash": "sha256:" + digest,
        "collected_at": listing["collected_at"],
        # 게시판은 날짜만 보여 준다. 그날 0시(한국)로 적는다
        "published_at": f"{listing['published_on']}T00:00:00+09:00",
        "observed_at": None,
        "observed_at_source": None,
        "observed_period_type": "none",
        "observed_period_start": None,
        "observed_period_end": None,
        # 글이 다루는 지역이 아니라 발행 기관의 지역(KOSIS 코드). 글의 지역은 P3 가 정한다
        "place_code_raw": site.place_code_raw,
        "place_code_system": "kosis",
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
        "locator": {"press_id": listing["press_id"]},
        # 제목 정정 등으로 보이는 칸이 바뀌면 새 판이다. 같은 글의 판은 locator 로 묶여
        # 최신본만 나간다
        "dedup_key": f"press:{listing['press_id']}:{digest[:12]}",
        "license_type": site.license_type,
        "storage_scope": "metadata",
        "run_id": run_id,
        "collector_version": COLLECTOR,
        "document": {
            "kind": "press_release",
            "title": listing["title"],
            "publisher": site.org,
            "categories": [listing["category"]] if listing["category"] else [],
            "keywords": [],
            "entities": {"locations": [], "persons": [], "organizations": []},
            "excerpt": None,
            "link": listing["url"],
            "fetch": None,
            "body": None,
        },
    }
    if validate(record):
        raise PressError("C1_INTAKE_VALIDATION_FAILED")
    return payload, record


def c1_pages(pages, run_id: str):
    for listings in pages:
        yield [to_c1(listing, run_id) for listing in listings]


def store_pages(conn, query: PressQuery, pages, run_id: str, **extra) -> dict:
    """autocommit 연결. 쪽마다 원본 장부에 저장하고, 실행 이력(job_run)에 결과를 남긴다.

    같은 글을 그대로 다시 받으면 원본이 같아(content_hash) 새 행이 생기지 않는다.
    extra 는 실행 이력 stats 에 그대로 붙는다(예: imported_from).
    """
    store = PostgresStore(conn)
    store.start(query, run_id, _utc_now())
    stats = {"pages": 0, "seen": 0, "inserted": 0, "duplicates": 0} | query.run_params() | extra
    try:
        for pairs in pages:
            saved = store.save([p for p, _ in pairs], [r for _, r in pairs])
            stats["pages"] += 1
            stats["seen"] += len(pairs)
            stats["inserted"] += saved
            stats["duplicates"] += len(pairs) - saved
    except BaseException as exc:
        status = "aborted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed"
        known = isinstance(exc, (PressError, CollectionError))
        code = str(exc) if known else "PRESS_COLLECTION_FAILED"
        store.finish(run_id, status, stats | {"error_code": code})
        raise
    store.finish(run_id, "ok", stats)
    return {"run_id": run_id, **stats}


def _written(pages, out):
    """쪽마다 C1 레코드를 JSONL 로 쓰고 그대로 넘긴다. 중간에 멈춰도 앞 쪽은 파일에 남는다."""
    for pairs in pages:
        for _, record in pairs:
            out.write(json.dumps(record, ensure_ascii=False).encode("utf-8") + b"\n")
        out.flush()
        yield pairs


def connect_from_env():
    """수집기 · 정제와 같은 루트 .env 의 DB 칸을 쓴다. 값은 출력하지 않는다."""
    config = dotenv_values(ROOT / ".env", interpolate=False)
    if not config.get("DB_PASSWORD"):
        raise PressError("DB_PASSWORD_MISSING")
    return psycopg.connect(
        host=config.get("POSTGRES_HOST") or "localhost",
        port=config.get("POSTGRES_PORT") or "5432",
        dbname=config.get("DB_NAME") or "issue_atlas",
        user=config.get("DB_USERNAME") or "postgres",
        password=config["DB_PASSWORD"],
        connect_timeout=5,
        autocommit=True,
    )


def main(argv=None, connect=connect_from_env, **options) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--site", choices=SITES, required=True)
    p.add_argument("--start", type=date.fromisoformat, default=date(2023, 1, 1))
    p.add_argument("--end", type=date.fromisoformat, default=date(2025, 12, 31))
    p.add_argument("--db", action="store_true")
    p.add_argument("--from-table", action="store_true")
    p.add_argument("--output", type=Path)
    args = p.parse_args(argv)
    if args.start > args.end:
        print("PRESS_INVALID_PERIOD", file=sys.stderr)
        return 2
    if args.from_table and not args.db:
        print("PRESS_FROM_TABLE_NEEDS_DB", file=sys.stderr)
        return 2
    run_id = f"press_{args.site}_" + uuid4().hex
    try:
        # Windows 에서도 \n 만 쓰게 바이트로
        stdout = None if args.db else sys.stdout.buffer
        with args.output.open("wb") if args.output else nullcontext(stdout) as out:
            if not args.db:
                pages = c1_pages(collect_pages(args.site, args.start, args.end, **options), run_id)
                count = sum(map(len, _written(pages, out)))
                print(json.dumps({"records": count}), file=sys.stderr)
                return 0
            query = PressQuery(args.site, args.start, args.end)
            with connect() as conn:
                if args.from_table:
                    listings = table_pages(conn, args.site, args.start, args.end)
                    extra = {"imported_from": "press_release"}
                else:
                    listings = collect_pages(args.site, args.start, args.end, **options)
                    extra = {}
                pages = c1_pages(listings, run_id)
                if out is not None:
                    pages = _written(pages, out)
                result = store_pages(conn, query, pages, run_id, **extra)
            print(json.dumps(result, ensure_ascii=False))
            return 0
    except (PressError, CollectionError) as exc:
        print(str(exc), file=sys.stderr)
    except psycopg.Error:
        # DSN·SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("PRESS_DB_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
