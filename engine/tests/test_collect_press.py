"""보도자료 목록 수집: 실제 게시판과 같은 모양의 가상 HTML 로 확인한다. 네트워크 없음."""

import itertools
import json
from datetime import UTC, date, datetime

import pytest

from pipeline.collect import press
from pipeline.collect.press import (
    PressError,
    PressQuery,
    collect_pages,
    main,
    parse_gwangju,
    parse_yeosu,
    to_c1,
)
from pipeline.refine.run import refine_records

AT = "2026-10-28T00:00:00Z"


def yeosu_page(rows):
    trs = "".join(
        f"""<tr><td>{n}</td><td class="list_cate">{cat}</td><td class="align_left">
        <a href="/www/govt/news/release/press?idx={idx}&amp;mode=view&amp;page_scale=100"
           title="{title} 에 대한 글내용 보기.">{title} <span class="icon_box">
           <span class="icon_new">새로운글</span></span></a></td>
        <td>{dept}</td><td>{day}</td><td>38</td></tr>"""
        for n, (idx, cat, title, dept, day) in enumerate(rows, 1)
    )
    return f"<html><body><table><tbody>{trs}</tbody></table></body></html>".encode()


def gwangju_page(rows):
    divs = "".join(
        f"""<div class="body_row"><div class="num"><span class="blind">번호</span>{n}</div>
        <div class="category"><span class="blind">분류</span>{cat}</div>
        <div class="subject"><a href="/boardView.do?seq={seq}" data-view="L" data-seq="{seq}"
           title="{title}">{title[:10]}...</a></div>
        <div class="date"><span class="blind">작성일</span>{day}</div></div>"""
        for n, (seq, cat, title, day) in enumerate(rows, 1)
    )
    return f'<div class="board_list_body">{divs}</div>'.encode()


EMPTY_YEOSU = b"<table><tbody><tr><td colspan='6'>No posts</td></tr></tbody></table>"
ROBOTS = b"User-agent: *\nAllow:/\nCrawl-Delay: 30\n"


class Web:
    """주소 → (상태, 바이트). 요청 순서와 시각을 남긴다."""

    def __init__(self, pages, robots=(200, ROBOTS)):
        self.pages, self.robots, self.calls, self.clock = pages, robots, [], 0.0

    def __call__(self, url):
        self.calls.append((url, self.clock))
        if url.endswith("/robots.txt"):
            return self.robots
        page = int(url.split("page=")[-1].split("&")[0]) if "page=" in url else 1
        if "movePage=" in url:
            page = int(url.split("movePage=")[1].split("&")[0])
        return self.pages.get(page, (200, EMPTY_YEOSU))

    def options(self):
        def sleep(seconds):
            self.clock += seconds

        return {"get": self, "sleep": sleep, "monotonic": lambda: self.clock, "now": lambda: AT}


def rows_yeosu(start_idx, days):
    return [
        (start_idx - i, "행정", f"가상시 보도 {start_idx - i}", "홍보과", d)
        for i, d in enumerate(days)
    ]


def test_parse_keeps_visible_fields_and_full_title():
    [y] = parse_yeosu(
        yeosu_page([(584169, "행정", "여수시, 청년 정착 지원", "홍보과", "2025-03-02")])
    )
    assert y == {
        "id": "584169",
        "category": "행정",
        "title": "여수시, 청년 정착 지원",
        "department": "홍보과",
        "published_on": "2025-03-02",
    }
    long = "광주시, 드림청년 400명 모집…청년 일경험 지원"
    [g] = parse_gwangju(gwangju_page([(22211, "행정", long, "2025-06-29")]))
    assert g == {
        "id": "22211",
        "category": "행정",
        "title": long,
        "department": None,
        "published_on": "2025-06-29",
    }
    assert parse_yeosu(EMPTY_YEOSU) == []


def test_yeosu_today_row_shows_time_and_gets_today(monkeypatch):
    monkeypatch.setattr(press, "_today_kst", lambda: "2026-10-30")
    [y] = parse_yeosu(yeosu_page([(584262, "행정", "여수시, 오늘 보도", "홍보과", "11:01:13")]))
    assert y["published_on"] == "2026-10-30"


def test_yeosu_today_uses_korean_date_at_utc_day_boundary(monkeypatch):
    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 10, 29, 15, 1, tzinfo=UTC).astimezone(tz)

    monkeypatch.setattr(press, "datetime", FixedDatetime)
    [row] = parse_yeosu(yeosu_page(rows_yeosu(1, ["00:01:00"])))
    assert row["published_on"] == "2026-10-30"


def test_yeosu_time_only_today_does_not_stop_historical_collection(monkeypatch):
    monkeypatch.setattr(press, "_today_kst", lambda: "2026-10-30")
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web(
        {
            1: (200, yeosu_page(rows_yeosu(4, ["11:01:13", "2026-10-29"]))),
            2: (200, yeosu_page(rows_yeosu(2, ["2025-12-31", "2022-12-31"]))),
        }
    )
    pages = list(collect_pages("yeosu", date(2023, 1, 1), date(2025, 12, 31), **web.options()))
    assert pages[0] == []
    assert [r["press_id"] for page in pages for r in page] == ["yeosu:2"]


@pytest.mark.parametrize("day", ["24:00:00", "11:60:00", "11:01:60", "unknown"])
def test_yeosu_invalid_time_is_not_assumed_to_be_today(day):
    web = Web({1: (200, yeosu_page(rows_yeosu(1, [day])))})
    with pytest.raises(PressError, match="^PRESS_UNRECOGNIZED_ROW$"):
        list(collect_pages("yeosu", date(2023, 1, 1), date(2025, 12, 31), **web.options()))


def test_yeosu_walks_until_older_than_start_and_respects_crawl_delay(monkeypatch):
    monkeypatch.setattr(press, "PAGE_SIZE", 3)
    web = Web(
        {
            1: (200, yeosu_page(rows_yeosu(10, ["2026-01-02", "2025-12-31", "2025-12-30"]))),
            2: (200, yeosu_page(rows_yeosu(7, ["2025-01-01", "2025-01-01", "2024-12-31"]))),
            3: (200, yeosu_page(rows_yeosu(4, ["2024-12-30", "2024-12-29", "2024-12-28"]))),
        }
    )
    pages = list(collect_pages("yeosu", date(2025, 1, 1), date(2025, 12, 31), **web.options()))
    ids = [r["press_id"] for page in pages for r in page]
    assert ids == ["yeosu:9", "yeosu:8", "yeosu:7", "yeosu:6"]  # 3쪽은 요청하지 않는다
    assert [url.rsplit("/", 1)[-1] for url, _ in web.calls] == [
        "robots.txt",
        "press?page_scale=100&page=1",
        "press?page_scale=100&page=2",
    ]
    times = [t for _, t in web.calls]
    assert times[1] - times[0] >= 30 and times[2] - times[1] >= 30
    record = pages[0][0]
    assert record["url"].endswith("press?idx=9&mode=view")
    assert (record["license_type"], record["storage_scope"]) == ("KOGL-4", "metadata")
    assert (record["place_code_raw"], record["collected_at"]) == ("46130", AT)


def test_gwangju_uses_server_period_and_minimum_interval(monkeypatch):
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web(
        {
            1: (
                200,
                gwangju_page(
                    [
                        (2, "행정", "가상 보도 2", "2025-02-01"),
                        (1, "복지", "가상 보도 1", "2025-01-02"),
                    ]
                ),
            ),
            2: (200, gwangju_page([(0, "행정", "가상 보도 0", "2025-01-01")])),
        },
        robots=(404, b""),
    )
    pages = list(collect_pages("gwangju", date(2025, 1, 1), date(2025, 12, 31), **web.options()))
    assert [r["press_id"] for p in pages for r in p] == ["gwangju:2", "gwangju:1", "gwangju:0"]
    assert "searchSDe=2025-01-01&searchEDe=2025-12-31" in web.calls[1][0]
    assert web.calls[2][1] - web.calls[1][1] >= press.MIN_INTERVAL
    assert pages[0][0]["place_code_raw"] == "29" and pages[0][0]["department"] is None


@pytest.mark.parametrize(
    "robots,pages,code",
    [
        ((200, b"User-agent: *\nDisallow: /\n"), {}, "PRESS_ROBOTS_DISALLOWED"),
        ((503, b""), {}, "PRESS_ROBOTS_DISALLOWED"),
        ((200, ROBOTS), {1: (500, b"")}, "PRESS_HTTP_500"),
        ((200, ROBOTS), {1: (200, b"<html>changed</html>")}, "PRESS_NO_ROWS"),
        (
            (200, ROBOTS),
            {1: (200, yeosu_page([("x", "행정", "제목", "과", "2025-01-01")]))},
            "PRESS_UNRECOGNIZED_ROW",
        ),
        (
            (200, ROBOTS),
            {1: (200, yeosu_page([(1, "행정", "제목", "과", "2025.01.01")]))},
            "PRESS_UNRECOGNIZED_ROW",
        ),
    ],
)
def test_failures_stop_with_fixed_code(robots, pages, code):
    web = Web(pages, robots=robots)
    with pytest.raises(PressError, match=f"^{code}$"):
        list(collect_pages("yeosu", date(2025, 1, 1), date(2025, 12, 31), **web.options()))


def test_runaway_paging_stops(monkeypatch):
    monkeypatch.setattr(press, "PAGE_SIZE", 1)
    monkeypatch.setattr(press, "MAX_PAGES", 2)
    page = (200, yeosu_page(rows_yeosu(5, ["2025-06-01"])))
    web = Web({1: page, 2: page, 3: page})
    with pytest.raises(PressError, match="PRESS_TOO_MANY_PAGES"):
        list(collect_pages("yeosu", date(2025, 1, 1), date(2025, 12, 31), **web.options()))


def test_cli_prints_jsonl_without_db(capsysbinary, monkeypatch):
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web({1: (200, yeosu_page(rows_yeosu(3, ["2025-05-01"])))})

    def forbidden():
        pytest.fail("--db 없이 DB 에 연결하면 안 된다")

    assert (
        main(["--site", "yeosu", "--start", "2025-01-01"], connect=forbidden, **web.options()) == 0
    )
    out, err = capsysbinary.readouterr()
    [line] = out.decode().splitlines()
    assert json.loads(line)["document"]["title"] == "가상시 보도 3"
    assert json.loads(err) == {"records": 1}


def test_cli_from_table_needs_db(capsys):
    assert main(["--site", "gwangju", "--from-table"]) == 2
    assert capsys.readouterr().err.strip() == "PRESS_FROM_TABLE_NEEDS_DB"


def test_cli_output_file_replaces_stdout(capsysbinary, monkeypatch, tmp_path):
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web({1: (200, yeosu_page(rows_yeosu(3, ["2025-05-01"])))})
    path = tmp_path / "c1.json"
    assert main(["--site", "yeosu", "--output", str(path)], **web.options()) == 0
    out, err = capsysbinary.readouterr()
    assert out == b"" and json.loads(err) == {"records": 1}
    [line] = path.read_bytes().splitlines()
    assert json.loads(line)["locator"] == {"press_id": "yeosu:3"}


def test_transient_failure_is_retried_with_same_interval(monkeypatch):
    monkeypatch.setattr(press, "PAGE_SIZE", 2)
    web = Web({1: (200, yeosu_page(rows_yeosu(3, ["2025-05-01"])))})
    failures = iter([OSError(), (502, b"")])

    def flaky(url):
        if "page=1" in url and (failure := next(failures, None)) is not None:
            web.calls.append((url, web.clock))
            if isinstance(failure, OSError):
                raise failure
            return failure
        return web(url)

    options = web.options() | {"get": flaky}
    pages = list(collect_pages("yeosu", date(2025, 1, 1), date(2025, 12, 31), **options))
    assert [r["press_id"] for p in pages for r in p] == ["yeosu:3"]
    times = [t for url, t in web.calls if "page=1" in url]
    assert len(times) == 3 and all(b - a >= 30 for a, b in itertools.pairwise(times))


def listings(site, rows, at=AT):
    web = Web({1: (200, (yeosu_page if site == "yeosu" else gwangju_page)(rows))})
    options = web.options() | {"now": lambda: at}
    [page] = collect_pages(site, date(2025, 1, 1), date(2025, 12, 31), **options)
    return page


def test_c1_record_is_metadata_press_document():
    [listing] = listings("yeosu", rows_yeosu(3, ["2025-05-01"]))
    payload, record = to_c1(listing, "run-1")
    assert payload == {
        "press_id": "yeosu:3",
        "category": "행정",
        "department": "홍보과",
        "title": "가상시 보도 3",
        "published_on": "2025-05-01",
        "url": "https://www.yeosu.go.kr/www/govt/news/release/press?idx=3&mode=view",
    }
    query = PressQuery("yeosu")
    assert (record["source_id"], record["spec_id"]) == (query.source_id, query.spec_id)
    # 원본 주소는 쪽 번호가 없는 게시판이라 같은 글은 어느 쪽에서 읽어도 같다
    assert record["raw_url"] == "https://www.yeosu.go.kr/www/govt/news/release/press"
    assert record["published_at"] == "2025-05-01T00:00:00+09:00"
    assert (record["place_code_raw"], record["place_code_system"]) == ("46130", "kosis")
    assert (record["license_type"], record["storage_scope"]) == ("KOGL-4", "metadata")
    assert record["document"] | {"title": None} == {
        "kind": "press_release",
        "title": None,
        "publisher": "여수시",
        "categories": ["행정"],
        "keywords": [],
        "entities": {"locations": [], "persons": [], "organizations": []},
        "excerpt": None,
        "link": payload["url"],
        "fetch": None,
        "body": None,
    }


@pytest.mark.parametrize(
    ("site", "rows"),
    [
        ("yeosu", rows_yeosu(3, ["2025-05-01"])),
        ("gwangju", [(7, "", "가상 보도 7", "2025-05-01")]),
    ],
)
def test_press_documents_pass_refine(site, rows):
    [listing] = listings(site, rows)
    [out] = refine_records([to_c1(listing, "run-1")[1]])
    assert (out["validation_status"], out["issues"], out["is_latest"]) == ("pass", [], True)
    assert out["storage_scope"] == "metadata" and out["document"]["body"] is None


def test_recollecting_same_post_is_the_same_original():
    [first] = listings("yeosu", rows_yeosu(3, ["2025-05-01"]))
    [again] = listings("yeosu", rows_yeosu(3, ["2025-05-01"]), at="2026-11-02T00:00:00Z")
    a, b = to_c1(first, "run-1")[1], to_c1(again, "run-2")[1]
    assert a["content_hash"] == b["content_hash"] and a["dedup_key"] == b["dedup_key"]
    assert len(refine_records([a, b])) == 1


def test_corrected_title_is_a_new_revision_and_only_latest_is_ready():
    [old] = listings("yeosu", rows_yeosu(3, ["2025-05-01"]))
    corrected = [(3, "행정", "가상시 보도 3 (정정)", "홍보과", "2025-05-01")]
    [new] = listings("yeosu", corrected, at="2026-11-02T00:00:00Z")
    a, b = to_c1(old, "run-1")[1], to_c1(new, "run-2")[1]
    assert a["content_hash"] != b["content_hash"] and a["dedup_key"] != b["dedup_key"]
    refined = refine_records([a, b])
    assert [r["validation_status"] for r in refined] == ["pass", "pass"]
    assert len({r["obs_key"] for r in refined}) == 1
    assert [(r["document"]["title"], r["is_latest"]) for r in refined] == [
        ("가상시 보도 3", False),
        ("가상시 보도 3 (정정)", True),
    ]
