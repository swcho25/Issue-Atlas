"""보도자료 목록 수집: 실제 게시판과 같은 모양의 가상 HTML 로 확인한다. 네트워크 없음."""

import itertools
import json
from datetime import date

import pytest

from pipeline.collect import press
from pipeline.collect.press import PressError, collect_pages, main, parse_gwangju, parse_yeosu

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
    assert json.loads(line)["title"] == "가상시 보도 3"
    assert json.loads(err) == {"records": 1}


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
