"""기사 본문 수집 실행.

python -m pipeline.article <빅카인즈 뉴스 검색 응답 JSON 파일>
    → 기사마다 결과 JSONL (stdout), 상태별 건수 JSON (stderr)
python -m pipeline.article --db <빅카인즈 뉴스 검색 응답 JSON 파일>
    → 기사마다 결과를 news_article 에 저장, 건수 JSON (stdout)

빅카인즈 요청 fields 에 provider_link_page · content 가 있어야 한다 (content 로 같은 기사인지 본다).
출력에 기사 본문이 들어간다. 저장소 안에 두거나 커밋하지 않는다.
"""

import json
import sys
from collections import Counter
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .run import fetch_articles
from .store import ArticleStoreError, store_articles

ROOT = Path(__file__).resolve().parents[3]
USAGE = "사용법: python -m pipeline.article [--db] <빅카인즈 뉴스 검색 응답 JSON 파일>"


def connect_from_env():
    """수집기 · 정제와 같은 루트 .env 의 DB 칸을 쓴다. 값은 출력하지 않는다."""
    config = dotenv_values(ROOT / ".env", interpolate=False)
    if not config.get("DB_PASSWORD"):
        raise ArticleStoreError("DB_PASSWORD_MISSING")
    return psycopg.connect(
        host=config.get("POSTGRES_HOST") or "localhost",
        port=config.get("POSTGRES_PORT") or "5432",
        dbname=config.get("DB_NAME") or "issue_atlas",
        user=config.get("DB_USERNAME") or "postgres",
        password=config["DB_PASSWORD"],
        connect_timeout=5,
        autocommit=True,
    )


def main(argv: list[str], connect=connect_from_env, **options) -> int:
    db = argv[:1] == ["--db"]
    paths = argv[1:] if db else argv
    if len(paths) != 1:
        print(USAGE, file=sys.stderr)
        return 2
    data = json.loads(Path(paths[0]).read_text(encoding="utf-8"))
    found = data.get("return_object") if isinstance(data, dict) else None
    documents = found.get("documents") if isinstance(found, dict) else None
    if not isinstance(documents, list):
        print("BIGKINDS_DOCUMENTS_MISSING", file=sys.stderr)
        return 2
    if db:
        return _db(connect, documents, options)
    counts = Counter()
    # Windows 에서도 줄바꿈이 \r\n 으로 바뀌지 않게 바이트로 쓴다
    out = sys.stdout.buffer
    for result in fetch_articles(documents, **options):
        counts[result["status"]] += 1
        out.write(json.dumps(result, ensure_ascii=False, sort_keys=True).encode("utf-8") + b"\n")
        out.flush()
    print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False), file=sys.stderr)
    return 0


def _db(connect, documents, options) -> int:
    try:
        with connect() as conn:
            stats = store_articles(conn, documents, **options)
    except ArticleStoreError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except psycopg.Error:
        # DSN·SQL·기사 내용이 담길 수 있는 예외 문구는 출력하지 않는다
        print("ARTICLE_DB_ERROR", file=sys.stderr)
        return 1
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
