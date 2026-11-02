"""P3 를 아직 돌리지 않은 기사 → 주피터 추출기 입력 JSONL (contracts/p3 「입력」).

python -m pipeline.region.export --db --output <파일>   → 건수 JSON (stdout)

- 정제된 기사(normalized_ready, document.kind = news) 중 본문이 있고 news_event 에 없는 것만
- 같은 news_id 가 둘이면 최근 정제 하나 (장부에 같은 기사가 두 번 들어온 경우)
- 한 줄 = {id, title, lead(본문), published_at, source}.
  주피터 추출기 · p3-region-lab 입력과 같은 칸
- 출력에 기사 본문이 들어간다: 파일은 600 으로 만들고, 주피터로 옮긴 뒤 지운다
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg

from pipeline.collect.lofin import connect_from_env

ARTICLES = """
SELECT DISTINCT ON (news_id) news_id, title, body, published_at, publisher, loaded
FROM (
    SELECT n.record -> 'locator' ->> 'news_id' AS news_id,
           n.record -> 'document' ->> 'title' AS title,
           n.record -> 'document' ->> 'body' AS body,
           n.record ->> 'published_at' AS published_at,
           n.record -> 'document' ->> 'publisher' AS publisher,
           EXISTS (SELECT 1 FROM news_event e
                   WHERE e.news_id = n.record -> 'locator' ->> 'news_id') AS loaded,
           n.refined_at, n.id
    FROM normalized_ready n
    WHERE n.record -> 'document' ->> 'kind' = 'news'
) a
WHERE news_id IS NOT NULL
ORDER BY news_id, refined_at DESC, id DESC
"""
# 같은 news_id 의 정제 행 수 − 1 의 합 (DISTINCT ON 이 버린 행)
DUPLICATES = """
SELECT count(*) - count(DISTINCT n.record -> 'locator' ->> 'news_id')
FROM normalized_ready n
WHERE n.record -> 'document' ->> 'kind' = 'news' AND n.record -> 'locator' ->> 'news_id' IS NOT NULL
"""


def export(conn, output: Path) -> dict:
    """내보낸 기사 수와 건너뛴 이유별 수. 본문은 stdout · 로그에 쓰지 않는다"""
    skipped = {"loaded": 0, "no_body": 0, "duplicate": conn.execute(DUPLICATES).fetchone()[0]}
    lines = []
    for news_id, title, body, published_at, publisher, loaded in conn.execute(ARTICLES):
        if loaded:
            skipped["loaded"] += 1
        elif not (body or "").strip():
            skipped["no_body"] += 1
        else:
            article = {"id": news_id, "title": title or "", "lead": body,
                       "published_at": published_at, "source": publisher or ""}  # fmt: skip
            lines.append(json.dumps(article, ensure_ascii=False) + "\n")
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with open(fd, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return {"exported": len(lines), "skipped": skipped, "output": str(output)}


def main(argv=None, connect=connect_from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--db", action="store_true", required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args(argv)
    try:
        with connect() as conn:
            print(json.dumps(export(conn, args.output), ensure_ascii=False))
        return 0
    except psycopg.Error:
        # DSN · SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("REGION_EXPORT_DB_ERROR", file=sys.stderr)
    except Exception:
        print("REGION_EXPORT_FAILED", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
