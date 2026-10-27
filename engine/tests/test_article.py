"""기사 본문 수집 · 요약. 실제 기사 대신 직접 쓴 가상 기사 HTML 로, 네트워크 없이 확인한다."""

import json
import ssl
from urllib.error import URLError

import pytest
import truststore

from pipeline.article import LEAD3, fetch_articles
from pipeline.article.__main__ import main
from pipeline.article.fetch import normalize_url, tls_context

AT = "2026-10-27T01:00:00Z"
URL = "https://news.example.com/article/1"
ROBOTS = "https://news.example.com/robots.txt"

LINES = [
    "가상시의 주민등록 인구가 1년 사이 1천200명 줄어 3만 명 선이 무너졌다.",
    "시는 올해 청년 전입 지원금을 두 배로 늘리고 빈집 정비 사업도 함께 추진한다고 밝혔다.",
    '"떠나는 이유부터 들어야 한다"고 한 주민은 말했다.',
    "전문가들은 일자리와 교통 대책이 함께 가야 효과가 난다고 지적한다.",
    "가상시는 다음 달 읍면동을 돌며 주민 설명회를 열고 의견을 모을 계획이다.",
    "설명회 일정은 시청 누리집과 읍면동 게시판에 차례로 알린다.",
]
OTHER = [
    "가상군 바닷가 마을에 올해 첫 해맞이 축제가 열려 관광객 수천 명이 몰렸다.",
    "군은 축제 기간 임시 주차장과 셔틀버스를 운영해 교통 혼잡을 줄였다고 설명했다.",
    "상인들은 겨울 비수기에 손님이 늘어 반갑다는 반응을 보였다.",
    "군은 내년에는 야간 공연과 먹거리 장터를 더해 규모를 키울 방침이다.",
]
# 빅카인즈 content 처럼 본문 앞 200자 (줄바꿈 포함)
CONTENT = "\n".join(LINES)[:200]


def page(lines, title="가상시 인구 3만 선 무너져"):
    paragraphs = "".join(f"<p>{line}</p>" for line in lines)
    return (
        '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        f"<title>{title}</title></head><body>"
        '<nav><a href="/">홈</a> <a href="/politics">정치</a> 메뉴 바로가기</nav>'
        f"<article><h1>{title}</h1>{paragraphs}</article>"
        "<footer>무단 전재 및 재배포 금지 · 가상일보</footer></body></html>"
    ).encode()


def doc(link=URL, content=CONTENT, news_id="99999999.20240101000000001"):
    return {
        "news_id": news_id,
        "provider": "가상일보",
        "provider_link_page": link,
        "content": content,
    }


class Clock:
    def __init__(self):
        self.t = 100.0

    def monotonic(self):
        return self.t

    def sleep(self, seconds):
        self.t += seconds


class Web:
    """주소 → (HTTP 상태, 바이트) 또는 예외. 없는 주소는 404."""

    def __init__(self, pages=None, clock=None):
        self.pages = {URL: (200, page(LINES))} | (pages or {})
        self.clock = clock
        self.requested = []

    def __call__(self, url):
        self.requested.append((url, self.clock.t if self.clock else None))
        answer = self.pages.get(url, (404, b""))
        if isinstance(answer, Exception):
            raise answer
        return answer

    @property
    def urls(self):
        return [url for url, _ in self.requested]


def run(docs, web, clock=None):
    clock = clock or Clock()
    web.clock = web.clock or clock
    return list(
        fetch_articles(docs, get=web, sleep=clock.sleep, monotonic=clock.monotonic, now=lambda: AT)
    )


def test_article_body_and_summary():
    [out] = run([doc()], Web())

    assert out["status"] == "ok"
    assert out["http_status"] == 200
    assert out["url"] == URL
    assert out["fetched_at"] == AT
    assert all(line in out["body"] for line in LINES)
    # 메뉴 · 저작권 꼬리말은 본문이 아니다
    assert "메뉴 바로가기" not in out["body"]
    assert "무단 전재" not in out["body"]
    assert out["summary"] == " ".join(LINES[:3])
    assert out["summarizer"] == LEAD3.name


def test_missing_link_is_not_requested():
    web = Web()

    [out] = run([doc(link="  ")], web)

    assert out["status"] == "NO_LINK"
    assert out["body"] is None
    assert web.requested == []


@pytest.mark.parametrize(
    ("link", "expected"),
    [
        ("www.example.com/news/1", "http://www.example.com/news/1"),
        (" https://news.example.com/a ", "https://news.example.com/a"),
        ("", None),
        (None, None),
        ("mailto:desk@example.com", None),
    ],
)
def test_link_is_normalized(link, expected):
    # 빅카인즈가 http:// 없이 주는 링크가 있다 (남도일보, 2026-10-27 확인)
    assert normalize_url(link) == expected


def test_link_without_scheme_is_tried_over_http():
    web = Web({"http://news.example.com/article/1": (200, page(LINES))})

    [out] = run([doc(link="news.example.com/article/1")], web)

    assert out["status"] == "ok"
    assert web.urls[-1] == "http://news.example.com/article/1"


def test_missing_bigkinds_content_skips_fetch():
    # content 가 없으면 같은 기사인지 확인할 수 없으니 가져오지 않는다
    web = Web()

    [out] = run([doc(content="")], web)

    assert out["status"] == "NO_REFERENCE"
    assert web.requested == []


@pytest.mark.parametrize(
    "robots",
    [
        (200, b"User-agent: *\nDisallow: /article/\n"),
        (200, b"User-agent: IssueAtlasBot\nDisallow: /\n"),
        (403, b""),
        (503, b""),
    ],
    ids=["all-agents", "our-agent", "forbidden", "server-error"],
)
def test_robots_disallowed_page_is_not_requested(robots):
    web = Web({ROBOTS: robots})

    [out] = run([doc()], web)

    assert out["status"] == "ROBOTS_DISALLOWED"
    assert web.urls == [ROBOTS]


def test_robots_is_read_once_per_site():
    second = "https://news.example.com/article/2"
    web = Web({ROBOTS: (200, b"User-agent: *\nDisallow: /admin/\n"), second: (200, page(LINES))})

    outs = run([doc(), doc(link=second)], web)

    assert [o["status"] for o in outs] == ["ok", "ok"]
    assert web.urls == [ROBOTS, URL, second]


def test_same_site_requests_are_spaced_but_other_sites_are_not():
    clock = Clock()
    other = "https://other.example.org/news/9"
    web = Web({other: (200, page(LINES))}, clock)

    run([doc(), doc(link=URL), doc(link=other)], web, clock)

    times = {}
    for url, t in web.requested:
        times.setdefault(url.split("/")[2], []).append(t)
    same = times["news.example.com"]
    assert all(b - a >= 1.0 for a, b in zip(same, same[1:], strict=False))
    # 다른 사이트의 첫 요청은 기다리지 않는다
    assert times["other.example.org"][0] == same[-1]


@pytest.mark.parametrize("status", [404, 500])
def test_http_error_page(status):
    [out] = run([doc()], Web({URL: (status, b"")}))

    assert out["status"] == "HTTP_ERROR"
    assert out["http_status"] == status
    assert out["body"] is None


@pytest.mark.parametrize(
    "error",
    [URLError("down"), TimeoutError(), ssl.SSLCertVerificationError("bad chain")],
    ids=["url", "timeout", "certificate"],
)
def test_network_error(error):
    [out] = run([doc()], Web({URL: error}))

    assert out["status"] == "NETWORK_ERROR"
    assert out["body"] is None


def test_robots_network_error_stops_before_page():
    web = Web({ROBOTS: URLError("down")})

    [out] = run([doc()], web)

    assert out["status"] == "NETWORK_ERROR"
    assert web.urls == [ROBOTS]


@pytest.mark.parametrize(
    "html",
    [b"", "<html><body><p>영상 뉴스</p></body></html>".encode()],
    ids=["empty", "too-short"],
)
def test_page_without_body(html):
    [out] = run([doc()], Web({URL: (200, html)}))

    assert out["status"] == "NO_BODY"
    assert out["body"] is None


def test_different_article_is_discarded():
    [out] = run([doc()], Web({URL: (200, page(OTHER, title="가상군 해맞이 축제"))}))

    assert out["status"] == "CONTENT_MISMATCH"
    assert out["body"] is None
    assert out["summary"] is None


def test_matching_survives_missing_first_line():
    # 추출기가 첫 줄(기자 이름 등)을 빼도 content 의 뒷부분 조각으로 같은 기사를 알아본다
    [out] = run([doc()], Web({URL: (200, page(LINES[1:]))}))

    assert out["status"] == "ok"


def test_tls_uses_os_store_and_keeps_verification():
    context = tls_context()

    assert isinstance(context, truststore.SSLContext)
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_lead3_takes_first_three_sentences():
    body = (
        '사진=가상시 제공\n첫째 문장이다. 둘째 문장은 3.5% 늘었다.\n"셋째 문장이다." 넷째 문장이다.'
    )

    # 마침표로 끝나지 않는 줄(사진 설명 · 기자 이름)은 문장으로 세지 않는다
    assert LEAD3.run(body) == '첫째 문장이다. 둘째 문장은 3.5% 늘었다. "셋째 문장이다."'


@pytest.mark.parametrize(
    ("body", "expected"), [("한 문장뿐이다.", "한 문장뿐이다."), ("제목만", None)]
)
def test_lead3_short_body(body, expected):
    assert LEAD3.run(body) == expected


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("[가상일보=홍길동 기자] 첫째 문장이다.", "첫째 문장이다."),
        ("[가상일보(여수)=홍길동 기자] 첫째 문장이다.", "첫째 문장이다."),
        ("(여수=가상통신) 홍길동 기자 = 첫째 문장이다.", "첫째 문장이다."),
        # 마침표 없는 부제목 다음 줄에 머리말이 오기도 한다
        ("인구 3만 선 무너져\n[가상일보=홍길동 기자] 첫째 문장이다.", "첫째 문장이다."),
        # 기자 머리말이 아닌 말머리는 그대로 둔다
        ("[단독] 첫째 문장이다.", "[단독] 첫째 문장이다."),
    ],
    ids=["bracket", "bracket-region", "paren-wire", "after-subtitle", "tag"],
)
def test_lead3_drops_reporter_dateline(body, expected):
    # 헤럴드경제 6건이 첫 문장 앞에 [언론사(지역)=기자명 기자] 를 붙였다 (2026-10-27 확인)
    assert LEAD3.run(body) == expected


def response_file(tmp_path, documents):
    path = tmp_path / "bigkinds.json"
    data = {"result": 0, "return_object": {"total_hits": len(documents), "documents": documents}}
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return str(path)


def test_cli_writes_one_json_line_per_article(tmp_path, capsysbinary):
    clock = Clock()
    path = response_file(tmp_path, [doc(), doc(link="")])

    code = main([path], get=Web(), sleep=clock.sleep, monotonic=clock.monotonic, now=lambda: AT)

    out, err = capsysbinary.readouterr()
    lines = [json.loads(line) for line in out.decode("utf-8").splitlines()]
    assert code == 0
    assert [line["status"] for line in lines] == ["ok", "NO_LINK"]
    assert lines[0]["summary"] == " ".join(LINES[:3])
    assert b"\r\n" not in out
    assert json.loads(err.decode("utf-8")) == {"NO_LINK": 1, "ok": 1}


def test_cli_rejects_file_without_documents(tmp_path, capsys):
    path = tmp_path / "other.json"
    path.write_text('{"result": 0}', encoding="utf-8")

    assert main([str(path)]) == 2
    assert capsys.readouterr().err.strip() == "BIGKINDS_DOCUMENTS_MISSING"


def test_cli_usage(capsys):
    assert main([]) == 2
    assert "사용법" in capsys.readouterr().err
