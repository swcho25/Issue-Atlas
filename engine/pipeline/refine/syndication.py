"""기사 전재 묶기 — 같은 소식을 여러 언론사가 실은 기사를 한 묶음으로.

S15P31C108-267, P2 계약 「전재 묶음」.
python -m pipeline.refine.syndication --db [--apply]   → 건수 JSON (stdout)
- 정제된 최신 기사(normalized_ready, document.kind = news) 전체를 읽어
  묶음을 다시 계산한다
- 기본은 시험 실행: 같은 트랜잭션에서 news_syndication 을 바꿔 쓰고
  세어 본 뒤 되돌린다. --apply 일 때만 커밋
- 규칙 syn-0.1: 제목을 다듬어(괄호 · 기호 · 띄어쓰기 빼고 소문자)
  글자 2개 묶음(bigram) 집합의 Jaccard 가 0.7 이상이고 발행일(한국 날짜)이
  3일 안이면 이어진 것으로 보고, 이어진 기사를 모두 한 묶음으로(연결 요소).
  0.6 에서는 다른 기관의 같은 행사 기사(나눔 캠페인 성금 등)가 섞여
  0.7 로 정했다(개발 DB 3,483건 11/5 측정)
- 묶음 번호 = 묶음에서 가장 먼저 발행된 기사의 news_id
  (같은 시각이면 news_id 가 작은 것). 본문은 쓰지 않는다
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from pipeline.collect.lofin import connect_from_env

RULE_VERSION = "syn-0.1"
THRESHOLD = 0.7
WINDOW_DAYS = 3

_BRACKETS = re.compile(r"\[[^\]]*\]|\([^)]*\)|【[^】]*】|<[^>]*>")
_NOT_WORD = re.compile(r"[^가-힣a-z0-9]")

ARTICLES = """
SELECT n.record -> 'locator' ->> 'news_id', n.record -> 'document' ->> 'title',
       (n.record ->> 'published_at')::timestamptz
FROM normalized_ready n
WHERE n.record -> 'document' ->> 'kind' = 'news'
  AND n.record -> 'locator' ->> 'news_id' IS NOT NULL
"""


@dataclass(frozen=True)
class Article:
    news_id: str
    title: str
    published_at: datetime


def normalize_title(title: str) -> str:
    """괄호 속 말머리([단독] · (종합) …) · 기호 · 띄어쓰기를 빼고 소문자로"""
    return _NOT_WORD.sub("", _BRACKETS.sub("", (title or "").lower()))


def bigrams(text: str) -> frozenset[str]:
    if len(text) < 2:
        return frozenset([text]) if text else frozenset()
    return frozenset(text[i : i + 2] for i in range(len(text) - 1))


def similarity(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def group(articles: list[Article]) -> dict[str, tuple[str, int]]:
    """news_id → (묶음 번호, 묶음 기사 수). 혼자인 기사는 자기 news_id"""
    articles = sorted(articles, key=lambda a: (a.published_at, a.news_id))
    grams = [bigrams(normalize_title(a.title)) for a in articles]
    days = [_kst_date(a.published_at) for a in articles]
    by_day: dict[date, list[int]] = defaultdict(list)
    for i, day in enumerate(days):
        by_day[day].append(i)
    parent = list(range(len(articles)))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, day in enumerate(days):
        for offset in range(WINDOW_DAYS + 1):
            for j in by_day.get(day + timedelta(days=offset), []):
                if j > i and similarity(grams[i], grams[j]) >= THRESHOLD:
                    a, b = root(i), root(j)
                    if a != b:
                        # 먼저 발행된 기사(정렬 순서가 앞)가 대표
                        parent[max(a, b)] = min(a, b)
    members: dict[int, list[int]] = defaultdict(list)
    for i in range(len(articles)):
        members[root(i)].append(i)
    result = {}
    for head, items in members.items():
        for i in items:
            result[articles[i].news_id] = (articles[head].news_id, len(items))
    return result


def _kst_date(at: datetime) -> date:
    return at.astimezone(ZoneInfo("Asia/Seoul")).date()


def regroup(conn) -> dict:
    """정제된 최신 기사 전체를 묶어 news_syndication 을 통째로 바꾼다(호출한 쪽 트랜잭션 안에서)"""
    articles = {}
    for news_id, title, published_at in conn.execute(ARTICLES):
        if published_at is None:
            continue
        # 같은 기사의 판이 둘 이상 남아 있으면 하나만(최신본만 normalized_ready 에 있다)
        articles[news_id] = Article(news_id, title or "", published_at)
    groups = group(list(articles.values()))
    conn.execute("DELETE FROM news_syndication")
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO news_syndication (news_id, group_id, group_size, rule_version)"
            " VALUES (%s, %s, %s, %s)",
            [(news_id, g, size, RULE_VERSION) for news_id, (g, size) in sorted(groups.items())],
        )
    sizes = list(dict(groups.values()).values())
    multi = [s for s in sizes if s > 1]
    return {
        "rule_version": RULE_VERSION,
        "articles": len(groups),
        "groups": len(sizes),
        "multi_groups": len(multi),
        "grouped_articles": sum(multi),
        "largest": max(sizes, default=0),
    }


def main(argv=None, connect=connect_from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--db", action="store_true", required=True)
    p.add_argument("--apply", action="store_true", help="없으면 시험 실행(되돌림)")
    args = p.parse_args(argv)
    try:
        with connect() as conn, conn.transaction(force_rollback=not args.apply):
            result = regroup(conn)
        print(json.dumps({"apply": args.apply, **result}, ensure_ascii=False))
        return 0
    except psycopg.Error:
        # DSN · SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("SYNDICATION_DB_ERROR", file=sys.stderr)
    except Exception:
        print("SYNDICATION_FAILED", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
