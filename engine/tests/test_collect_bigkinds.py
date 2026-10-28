"""빅카인즈 → 본문 수집 → C1 기사 레코드. 가상 검색 응답 · 가상 기사 HTML, 네트워크 없음."""

import json
from contextlib import contextmanager
from datetime import date

import pytest

from pipeline.collect import bigkinds
from pipeline.collect.bigkinds import NewsQuery, collect, search, to_record
from pipeline.collect.kosis import CollectionError
from pipeline.refine.validate import validate
from tests.test_article import AT, CONTENT, URL, Clock, Web, doc

QUERY = NewsQuery(date(2025, 1, 1), date(2025, 1, 3))


def news(news_id, link=URL, content=CONTENT):
    return doc(link=link, content=content, news_id=news_id) | {
        "title": f"가상시 인구 기사 {news_id}",
        "published_at": "2025-01-01T09:30:00.000+09:00",
        "category": ["사회>사회일반", ""],
    }


class Search:
    """(날짜, offset) → 그 쪽 documents. 호출을 남긴다."""

    def __init__(self, days):
        self.days, self.calls = days, []

    def __call__(self, day, offset, api_key):
        self.calls.append((day.isoformat(), offset))
        rows = self.days.get(day.isoformat(), [])
        return rows[offset : offset + bigkinds.PAGE_SIZE], len(rows)


class MemoryStore:
    def __init__(self, fetched=()):
        self.raw, self.runs, self._fetched = {}, {}, set(fetched)

    def start(self, query, run_id, at):
        self.runs[run_id] = {"status": None}

    def fetched(self, news_ids):
        return self._fetched & set(news_ids)

    def save(self, rows, records):
        new = [r for r in records if r["content_hash"] not in self.raw]
        self.raw |= {r["content_hash"]: (row, r) for row, r in zip(rows, records, strict=True)}
        return len(new)

    def finish(self, run_id, status, stats):
        self.runs[run_id] = {"status": status, **stats}


def options(web):
    clock = Clock()
    web.clock = clock
    return {"get": web, "sleep": clock.sleep, "monotonic": clock.monotonic, "now": lambda: AT}


def test_search_pages_each_day_and_keeps_first_copy(monkeypatch):
    monkeypatch.setattr(bigkinds, "PAGE_SIZE", 2)
    fake = Search(
        {"2025-01-01": [news("a"), news("b"), news("c")], "2025-01-02": [news("a") | {"x": 1}]}
    )
    documents, calls = search(QUERY, "key", fake)
    assert [d["news_id"] for d in documents] == ["a", "b", "c"]
    assert fake.calls == [("2025-01-01", 0), ("2025-01-01", 2), ("2025-01-02", 0)]
    assert calls == 3 and "x" not in documents[0]  # 요청한 칸만 남긴다


def test_ok_article_becomes_full_record_that_passes_intake():
    payload, record = to_record(news("a"), fetched_ok(), "run", AT)
    assert validate(record) == []
    assert record["storage_scope"] == "full"
    assert "가상시의 주민등록 인구" in record["document"]["body"]
    assert record["document"]["categories"] == ["사회>사회일반"]
    assert record["document"]["link"] == URL and record["dedup_key"] == "bigkinds:a:ok"
    assert payload["bigkinds"]["content"] == CONTENT and payload["article"]["status"] == "ok"
    again = to_record(news("a"), fetched_ok() | {"fetched_at": "2026-10-29T00:00:00Z"}, "r2", AT)
    assert again[1]["content_hash"] == record["content_hash"]  # 요청 시각은 지문에 없다


def fetched_ok():
    [result] = list(bigkinds.fetch_articles([news("a")], **options(Web())))
    assert result["status"] == "ok"
    return result


def test_failed_article_is_metadata_without_body():
    [result] = list(bigkinds.fetch_articles([news("b", link=None)], **options(Web())))
    _, record = to_record(news("b", link=None), result, "run", AT)
    assert validate(record) == []
    assert (record["storage_scope"], record["document"]["body"]) == ("metadata", None)
    assert record["document"]["fetch"]["status"] == "NO_LINK"


def test_collect_skips_fetched_articles_and_saves_in_chunks(monkeypatch):
    monkeypatch.setattr(bigkinds, "SAVE_EVERY", 1)
    web = Web()
    fake = Search({"2025-01-01": [news("a"), news("b", link=None), news("done")]})
    store = MemoryStore(fetched={"done"})
    result = collect(QUERY, "key", store, fetch=fake, **options(web))
    assert (result["received"], result["skipped"], result["inserted"]) == (3, 1, 2)
    assert result["fetch_status"] == {"NO_LINK": 1, "ok": 1}
    assert result["start"] == "2025-01-01" and result["until"] == "2025-01-03"
    assert [u for u, _ in web.requested] == ["https://news.example.com/robots.txt", URL]
    again = collect(QUERY, "key", store, fetch=fake, **options(Web()))
    assert again["inserted"] == 0  # 같은 결과는 같은 원본
    assert {s["status"] for s in store.runs.values()} == {"ok"}


@pytest.mark.parametrize(
    "fetch,code",
    [
        (Search({"2025-01-01": [{"title": "news_id 없음"}]}), "BIGKINDS_INVALID_DOCUMENT"),
        (lambda *a: (_ for _ in ()).throw(CollectionError("BIGKINDS_API_ERROR")), "API_ERROR"),
    ],
)
def test_failures_are_recorded_without_raw(fetch, code):
    store = MemoryStore()
    with pytest.raises(CollectionError, match=code):
        collect(QUERY, "key", store, fetch=fetch, **options(Web()))
    assert not store.raw and next(iter(store.runs.values()))["status"] == "failed"


def test_missing_key_and_call_limit(monkeypatch):
    store = MemoryStore()
    with pytest.raises(CollectionError, match="BIGKINDS_KEY_MISSING"):
        collect(QUERY, "", store, fetch=Search({}), **options(Web()))
    monkeypatch.setattr(bigkinds, "MAX_CALLS", 1)
    with pytest.raises(CollectionError, match="BIGKINDS_CALL_LIMIT"):
        search(QUERY, "key", Search({}))


@pytest.mark.parametrize(
    "body,code",
    [
        (b'{"result": 0, "return_object": {"total_hits": 1, "documents": [{}]}}', None),
        (b'{"result": 1, "reason": "bad key"}', "BIGKINDS_API_ERROR"),
        (b'{"result": 0, "return_object": {"documents": []}}', "BIGKINDS_INVALID_RESPONSE"),
        (b'{"result": 0, "echo": "secret-key"}', "BIGKINDS_SECRET_IN_RESPONSE"),
        (b"<html>", "BIGKINDS_INVALID_RESPONSE"),
    ],
)
def test_fetch_page_checks_response(monkeypatch, body, code):
    sent = []

    class Opener:
        @contextmanager
        def open(self, request, timeout):
            sent.append(json.loads(request.data))

            class Response:
                def read(self, *args):
                    return body

            yield Response()

    monkeypatch.setattr(bigkinds, "build_opener", lambda *a: Opener())
    if code is None:
        assert bigkinds.fetch_page(date(2025, 1, 1), 0, "secret-key") == ([{}], 1)
        argument = sent[0]["argument"]
        assert {"provider_link_page", "content"} <= set(argument["fields"])
        assert argument["published_at"] == {"from": "2025-01-01", "until": "2025-01-02"}
    else:
        with pytest.raises(CollectionError, match=code):
            bigkinds.fetch_page(date(2025, 1, 1), 0, "secret-key")
