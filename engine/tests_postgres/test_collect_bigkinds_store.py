"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

빅카인즈 기사를 raw_record(V0002) + 장부(V0005)에 저장하고, P2 가 장부를 정제한다.
"""

from datetime import date

import pytest

from pipeline.collect.bigkinds import NewsQuery, NewsStore, collect
from pipeline.refine.store import refine_raw
from tests.test_article import Web
from tests.test_collect_bigkinds import Search, news, options
from tests_postgres.conftest import fresh_schema

QUERY = NewsQuery(date(2025, 1, 1), date(2025, 1, 2))


@pytest.fixture
def news_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
        ),
    )


def test_articles_are_raw_rows_with_ledger_and_ok_ones_are_not_refetched(news_db):
    conn, _ = news_db
    store = NewsStore(conn)
    search = Search({"2025-01-01": [news("a"), news("b", link=None)]})
    first = collect(QUERY, "key", store, fetch=search, **options(Web()))
    assert (first["inserted"], first["skipped"]) == (2, 0)
    rows = conn.execute(
        "SELECT c1_record->>'storage_scope', payload->'article'->>'status',"
        " c1_record->>'content_hash' = content_hash FROM raw_record ORDER BY 2"
    ).fetchall()
    assert rows == [("metadata", "NO_LINK", True), ("full", "ok", True)]
    assert conn.execute("SELECT storage_scope FROM source").fetchone() == ("metadata",)
    assert conn.execute("SELECT evidence_class FROM source_spec").fetchone() == ("documents",)

    web = Web()
    second = collect(QUERY, "key", store, fetch=search, **options(web))
    # 본문을 받은 a 는 다시 요청하지 않고, 링크가 없던 b 는 같은 결과라 같은 원본이다
    assert (second["skipped"], second["inserted"], second["duplicates"]) == (1, 0, 1)
    assert web.requested == []
    stats = conn.execute("SELECT stats FROM job_run ORDER BY started_at").fetchall()
    assert [s["start"] for (s,) in stats] == ["2025-01-01", "2025-01-01"]

    result = refine_raw(conn)
    assert result["raw"] == 2 and not result["skipped"]
