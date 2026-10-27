"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

기사 본문 수집 결과를 news_article(V0007)에 저장한다. 실제 기사 대신 가상 기사 HTML 을 쓴다.
"""

import json

import psycopg
import pytest

from pipeline.article.__main__ import main
from pipeline.article.store import ArticleStoreError, store_articles
from tests.test_article import AT, LINES, OTHER, URL, Clock, Web, doc, page

URL2 = "https://news.example.com/article/2"
META = {
    "title": "가상시 인구 3만 선 무너져",
    "published_at": "2024-01-02T09:30:00.000+09:00",
    "category": ["사회>사회일반", ""],
}


def article(**changes):
    return doc() | META | changes


def other_article():
    content = "\n".join(OTHER)[:200]
    return doc(link=URL2, content=content, news_id="99999999.20240101000000002") | META


def options(web):
    clock = Clock()
    web.clock = clock
    return {"get": web, "sleep": clock.sleep, "monotonic": clock.monotonic, "now": lambda: AT}


def rows(conn):
    return conn.execute(
        "SELECT news_id, status, http_status, body IS NOT NULL FROM news_article ORDER BY news_id"
    ).fetchall()


def test_each_article_is_stored_with_bigkinds_metadata(article_db):
    conn, _ = article_db
    documents = [article(), doc(link="", news_id="99999999.20240101000000003") | META]

    stats = store_articles(conn, documents, **options(Web()))

    assert stats == {
        "documents": 2,
        "skipped": 0,
        "inserted": 2,
        "updated": 0,
        "status": {"NO_LINK": 1, "ok": 1},
    }
    ok = conn.execute(
        "SELECT provider, title, published_at = %s::timestamptz, category, url, fetcher, body "
        "FROM news_article_ready",
        (META["published_at"],),
    ).fetchall()
    assert len(ok) == 1
    provider, title, same_time, category, url, fetcher, body = ok[0]
    assert (provider, title, same_time, url, fetcher) == (
        "가상일보",
        META["title"],
        True,
        URL,
        "article-0.1.0",
    )
    assert category == ["사회>사회일반"]  # 빅카인즈의 빈 분류는 버린다
    assert all(line in body for line in LINES)
    # 실패한 기사도 이유와 함께 한 행으로 남지만 다음 단계에는 보이지 않는다
    assert rows(conn)[1] == ("99999999.20240101000000003", "NO_LINK", None, False)


def test_running_again_skips_stored_bodies_and_retries_failures(article_db):
    conn, _ = article_db
    store_articles(conn, [article(), other_article()], **options(Web({URL2: (503, b"")})))
    assert [r[1] for r in rows(conn)] == ["ok", "HTTP_ERROR"]
    before = conn.execute("SELECT stored_at FROM news_article WHERE status = 'ok'").fetchone()

    web = Web({URL2: (200, page(OTHER, title="가상군 해맞이 축제"))})
    stats = store_articles(conn, [article(), other_article()], **options(web))

    assert URL not in web.urls and URL2 in web.urls  # 이미 받은 본문은 다시 요청하지 않는다
    assert (stats["skipped"], stats["inserted"], stats["updated"]) == (1, 0, 1)
    assert [r[1] for r in rows(conn)] == ["ok", "ok"]
    after = conn.execute(
        "SELECT stored_at FROM news_article WHERE news_id = %s", (article()["news_id"],)
    ).fetchone()
    assert after == before


def test_same_article_twice_in_one_response_is_one_row(article_db):
    conn, _ = article_db
    web = Web()

    stats = store_articles(conn, [article(), article()], **options(web))

    assert stats["inserted"] == 1 and len(rows(conn)) == 1
    assert web.urls.count(URL) == 1


def test_document_without_news_id_stops_before_any_request(article_db):
    conn, _ = article_db
    web = Web()

    with pytest.raises(ArticleStoreError, match="BIGKINDS_NEWS_ID_MISSING"):
        store_articles(conn, [article(), article(news_id=None)], **options(web))

    assert web.requested == [] and rows(conn) == []


@pytest.mark.parametrize(("status", "body"), [("ok", None), ("NO_BODY", "본문")])
def test_body_is_kept_only_for_fetched_articles(article_db, status, body):
    conn, _ = article_db

    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO news_article (news_id, status, fetcher, body) VALUES ('x', %s, 'f', %s)",
            (status, body),
        )


def test_cli_db_mode_stores_and_prints_counts(article_db, tmp_path, capsys):
    conn, connect = article_db
    path = tmp_path / "bigkinds.json"
    path.write_text(
        json.dumps({"return_object": {"documents": [article()]}}, ensure_ascii=False), "utf-8"
    )

    assert main(["--db", str(path)], connect=connect, **options(Web())) == 0

    printed = json.loads(capsys.readouterr().out)
    assert printed["inserted"] == 1 and printed["status"] == {"ok": 1}
    assert rows(conn)[0][1] == "ok"
