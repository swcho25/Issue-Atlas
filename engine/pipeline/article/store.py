"""기사 본문 수집 결과를 news_article(V0007)에 저장한다.

빅카인즈 기사 하나 = 한 행(news_id). 이미 본문을 받은(ok) 기사는 다시 요청하지 않고,
실패한 기사만 다시 받아 그 결과로 덮어쓴다.
기사마다 받는 대로 저장한다(중간에 멈춰도 앞 기사는 남는다).
"""

from collections import Counter

from psycopg.types.json import Jsonb

from .run import fetch_articles

COLUMNS = (
    "news_id",
    "provider",
    "title",
    "published_at",
    "category",
    "url",
    "status",
    "http_status",
    "fetched_at",
    "fetcher",
    "body",
)
UPSERT = f"""
INSERT INTO news_article ({", ".join(COLUMNS)})
VALUES ({", ".join(["%s"] * len(COLUMNS))})
ON CONFLICT (news_id) DO UPDATE SET
    {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS[1:])}, stored_at = now()
WHERE news_article.status <> 'ok'
RETURNING (xmax = 0) AS inserted
"""


class ArticleStoreError(Exception):
    """입력 · 연결 상태가 저장 규칙과 맞지 않을 때의 고정 원인 코드."""


def store_articles(conn, documents: list[dict], **options) -> dict:
    """autocommit 연결. options 는 fetch_articles 로 넘긴다(테스트의 가짜 요청 등)."""
    if not conn.autocommit:
        raise ArticleStoreError("STORE_REQUIRES_AUTOCOMMIT")
    # 키가 없으면 저장할 행을 정할 수 없다. 요청하기 전에 멈춘다
    if any(not isinstance(d.get("news_id"), str) or not d["news_id"] for d in documents):
        raise ArticleStoreError("BIGKINDS_NEWS_ID_MISSING")
    by_id = {}
    for d in documents:
        by_id.setdefault(d["news_id"], d)  # 한 응답에 같은 기사가 두 번 오면 처음 것
    stored = {
        row[0]
        for row in conn.execute(
            "SELECT news_id FROM news_article WHERE status = 'ok' AND news_id = ANY(%s)",
            (list(by_id),),
        )
    }
    todo = [d for news_id, d in by_id.items() if news_id not in stored]
    totals, status = Counter(), Counter()
    for result in fetch_articles(todo, **options):
        row = conn.execute(UPSERT, _values(result, by_id[result["news_id"]])).fetchone()
        totals["inserted" if row[0] else "updated"] += 1
        status[result["status"]] += 1
    return {
        "documents": len(documents),
        "skipped": len(stored),
        "inserted": totals["inserted"],
        "updated": totals["updated"],
        "status": dict(sorted(status.items())),
    }


def _values(result, document):
    category = document.get("category")
    meta = {
        "title": document.get("title"),
        "published_at": document.get("published_at"),
        # 빅카인즈는 분류가 없으면 빈 문자열을 넣기도 한다
        "category": Jsonb([c for c in category if c] if isinstance(category, list) else []),
    }
    return [meta[c] if c in meta else result[c] for c in COLUMNS]
