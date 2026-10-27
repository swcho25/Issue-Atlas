"""빅카인즈 기사 목록 → 기사마다 본문 수집 결과."""

import time
from collections.abc import Iterable, Iterator
from datetime import UTC, datetime
from http.client import HTTPException

from .body import extract_body, has_reference, same_article
from .fetch import Pacer, Robots, http_getter, normalize_url

FETCHER = "article-0.1.0"


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def fetch_articles(
    documents: Iterable[dict],
    *,
    get=None,
    sleep=time.sleep,
    monotonic=time.monotonic,
    now=_utc_now,
    interval: float = 1.0,
) -> Iterator[dict]:
    """documents 는 빅카인즈 뉴스 검색 응답의 return_object.documents."""
    get = get or http_getter()
    pacer = Pacer(interval, sleep, monotonic)

    def paced_get(url):
        pacer.wait(url)
        return get(url)

    robots = Robots(paced_get)
    for document in documents:
        yield _fetch_one(document, paced_get, robots, now)


def _fetch_one(document, get, robots, now) -> dict:
    url = normalize_url(document.get("provider_link_page"))
    out = {
        "news_id": document.get("news_id"),
        "provider": document.get("provider"),
        "url": url,
        "fetcher": FETCHER,
        "status": None,
        "http_status": None,
        "fetched_at": None,
        "body": None,
    }
    if url is None:
        return out | {"status": "NO_LINK"}
    # content 가 없으면 같은 기사인지 확인할 수 없으니 요청하지 않는다
    if not has_reference(document.get("content")):
        return out | {"status": "NO_REFERENCE"}
    try:
        if not robots.allows(url):
            return out | {"status": "ROBOTS_DISALLOWED"}
        out["fetched_at"] = now()
        status, html = get(url)
    except (OSError, HTTPException):
        # 인증서 · 연결 · 시간 초과. 예외 문구는 남기지 않는다
        return out | {"status": "NETWORK_ERROR"}
    out["http_status"] = status
    if not 200 <= status < 300:
        return out | {"status": "HTTP_ERROR"}
    body = extract_body(html)
    if body is None:
        return out | {"status": "NO_BODY"}
    if not same_article(body, document["content"]):
        return out | {"status": "CONTENT_MISMATCH"}
    return out | {"status": "ok", "body": body}
