"""지자체 보도자료 게시판 목록 → press_release(V0010). 본문은 받지 않는다.

python -m pipeline.collect.press --site yeosu|gwangju [--start 2023-01-01 --end 2025-12-31]
    → 보도자료마다 JSONL (stdout), 건수 JSON (stderr)
python -m pipeline.collect.press --site yeosu|gwangju --db
    → press_release 에 쪽마다 저장, 건수 JSON (stdout)
--output <파일>: JSONL 을 그 파일에 쓴다 (--db 와 함께면 저장한 목록의 사본).
    서버 실행기(deploy/collector)가 실행마다 지정한다

여수시 보도자료는 공공누리 4유형(변경금지·상업적 이용금지), 광주광역시는 공공누리 표시가 없다.
P2 이용허락 표(KOGL-4 → metadata)에 맞춰 목록에 보이는 제목·분류·담당부서·등록일·링크만 둔다.
"""

import argparse
import json
import re
import sys
import time
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.robotparser import RobotFileParser

import lxml.html
import psycopg
from dotenv import dotenv_values

from pipeline.article.fetch import USER_AGENT, Pacer, http_getter

ROOT = Path(__file__).resolve().parents[3]
COLLECTOR = "press-0.1.0"
PAGE_SIZE = 100
MIN_INTERVAL = (
    2.0  # robots.txt 에 Crawl-Delay 가 없어도 같은 사이트 요청 사이에 둔다 (PRD 수집 예절)
)
ATTEMPTS = 3
MAX_PAGES = 300  # 여수시 2023–2025 는 약 100쪽. 넘으면 끝을 못 찾은 것으로 보고 멈춘다
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


class PressError(Exception):
    """외부 응답·예외 문자열을 포함하지 않는 고정 원인 코드."""


def _text(nodes) -> str:
    # 숨김 글자(<span class="blind">번호</span>)는 빼고 그 칸의 글자만
    return " ".join("".join(t for n in nodes for t in n.xpath("text()")).split())


def _doc(html: bytes):
    # 두 게시판 모두 UTF-8. 바이트를 그대로 주면 meta 가 없을 때 lxml 이 latin-1 로 읽는다
    return lxml.html.fromstring(html.decode("utf-8", errors="replace"))


def parse_yeosu(html: bytes) -> list[dict]:
    rows = []
    for tr in _doc(html).xpath("//table//tbody/tr"):
        cells = tr.xpath("./td")
        links = tr.xpath("./td//a[contains(@href, 'mode=view')]")
        if len(cells) != 6 or not links:
            continue  # 「등록된 글이 없습니다」 한 칸짜리 줄
        rows.append(
            {
                "id": parse_qs(urlsplit(links[0].get("href")).query).get("idx", [""])[0],
                "category": _text(cells[1:2]),
                "title": _text(links),
                "department": _text(cells[3:4]),
                "published_on": _text(cells[4:5]),
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
        "https://www.gwangju.go.kr/boardList.do?pageId=www789&boardId=BD_0000000027"
        "&movePage={page}&recordCnt=100&searchSDe={start}&searchEDe={end}",
        "https://www.gwangju.go.kr/boardView.do?pageId=www789&boardId=BD_0000000027&seq={id}",
        parse_gwangju,
        server_filter=True,
    ),
}


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


COLUMNS = (
    "press_id",
    "site",
    "org",
    "place_code_raw",
    "category",
    "department",
    "title",
    "published_on",
    "url",
    "license_type",
    "storage_scope",
    "collected_at",
    "collector",
)
CHANGING = ("category", "department", "title", "published_on", "url")
UPSERT = f"""
INSERT INTO press_release ({", ".join(COLUMNS)})
VALUES ({", ".join(["%s"] * len(COLUMNS))})
ON CONFLICT (press_id) DO UPDATE SET
    {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS[4:])}, stored_at = now()
WHERE ({", ".join(f"press_release.{c}" for c in CHANGING)})
    IS DISTINCT FROM ({", ".join(f"EXCLUDED.{c}" for c in CHANGING)})
RETURNING (xmax = 0) AS inserted
"""


def store_pages(conn, pages) -> dict:
    """autocommit 연결. 같은 글을 다시 받으면 제목 등 보이는 칸이 바뀐 때만 덮어쓴다."""
    stats = {"pages": 0, "seen": 0, "inserted": 0, "updated": 0, "unchanged": 0}
    for records in pages:
        stats["pages"] += 1
        with conn.transaction():
            for record in records:
                row = conn.execute(UPSERT, [record[c] for c in COLUMNS]).fetchone()
                stats["seen"] += 1
                stats["unchanged" if row is None else "inserted" if row[0] else "updated"] += 1
    return stats


def _written(pages, out):
    """쪽마다 JSONL 로 쓰고 그대로 넘긴다. 중간에 멈춰도 앞 쪽은 파일에 남는다."""
    for records in pages:
        for record in records:
            out.write(json.dumps(record, ensure_ascii=False).encode("utf-8") + b"\n")
        out.flush()
        yield records


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
    p.add_argument("--output", type=Path)
    args = p.parse_args(argv)
    if args.start > args.end:
        print("PRESS_INVALID_PERIOD", file=sys.stderr)
        return 2
    pages = collect_pages(args.site, args.start, args.end, **options)
    try:
        # Windows 에서도 \n 만 쓰게 바이트로
        stdout = None if args.db else sys.stdout.buffer
        with args.output.open("wb") if args.output else nullcontext(stdout) as out:
            if out is not None:
                pages = _written(pages, out)
            if args.db:
                with connect() as conn:
                    print(json.dumps(store_pages(conn, pages), ensure_ascii=False))
                return 0
            print(json.dumps({"records": sum(map(len, pages))}), file=sys.stderr)
            return 0
    except PressError as exc:
        print(str(exc), file=sys.stderr)
    except psycopg.Error:
        # DSN·SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("PRESS_DB_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
