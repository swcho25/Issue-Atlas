"""기사 원문 페이지 가져오기: 링크 보정 · robots.txt · 사이트별 간격 · OS 인증서."""

import ssl
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPSHandler, Request, build_opener
from urllib.robotparser import RobotFileParser

import truststore

USER_AGENT = "IssueAtlasBot/0.1 (SSAFY C108 Issue Atlas)"
MAX_BYTES = 5 * 1024 * 1024


def normalize_url(link: str | None) -> str | None:
    """빅카인즈 provider_link_page → 요청할 주소. 웹 주소가 아니면 None."""
    link = (link or "").strip()
    if not link:
        return None
    if not urlsplit(link).scheme:
        # http:// 없이 오는 링크가 있다 (남도일보, 2026-10-27 확인)
        link = "http://" + link
    parts = urlsplit(link)
    return link if parts.scheme in ("http", "https") and parts.netloc else None


def tls_context() -> ssl.SSLContext:
    # OS 인증서 저장소로 확인한다. 중간 인증서를 덜 보내는 사이트도 브라우저처럼 통과하고,
    # 검증 자체는 끄지 않는다 (부산일보 인증서 오류, 2026-10-27 확인)
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def http_getter():
    """주소 → (HTTP 상태, 본문 바이트). 연결 실패는 OSError 로 올라간다."""
    opener = build_opener(HTTPSHandler(context=tls_context()))

    def get(url: str) -> tuple[int, bytes]:
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "ko"})
        try:
            with opener.open(request, timeout=15) as response:
                return response.status, response.read(MAX_BYTES)
        except HTTPError as exc:
            return exc.code, b""

    return get


class Pacer:
    """같은 사이트에 보내는 요청 사이에 interval 초 이상을 둔다."""

    def __init__(self, interval, sleep, monotonic):
        self._interval = interval
        self._sleep = sleep
        self._monotonic = monotonic
        self._last = {}

    def wait(self, url):
        host = urlsplit(url).netloc
        if host in self._last:
            gap = self._monotonic() - self._last[host]
            if gap < self._interval:
                self._sleep(self._interval - gap)
        self._last[host] = self._monotonic()


class Robots:
    """사이트마다 robots.txt 를 한 번 읽어 둔다."""

    def __init__(self, get):
        self._get = get
        self._rules = {}

    def allows(self, url: str) -> bool:
        parts = urlsplit(url)
        site = f"{parts.scheme}://{parts.netloc}"
        if site not in self._rules:
            self._rules[site] = self._load(site)
        rules = self._rules[site]
        return rules if isinstance(rules, bool) else rules.can_fetch(USER_AGENT, url)

    def _load(self, site):
        status, body = self._get(site + "/robots.txt")
        if status == 200:
            rules = RobotFileParser()
            rules.parse(body.decode("utf-8", errors="replace").splitlines())
            return rules
        # RFC 9309: 접근 금지(401·403)나 서버 오류(5xx)면 전부 막힌 것으로,
        # 없으면(404 등) 허용으로 본다
        return not (status in (401, 403) or status >= 500)
