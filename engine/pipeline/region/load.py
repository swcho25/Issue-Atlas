"""추출 결과(region-extract) → news_event, 요약이 제대로 생긴 기사의 본문 지우기.

python -m pipeline.region.load --db --extract <JSONL> [--mentions <JSONL>]
                                [--delete-bodies] [--relocate] [--apply]   → 건수 JSON
- 기본은 시험 실행: 같은 트랜잭션에서 넣고 세어 본 뒤 되돌린다. --apply 일 때만 커밋
- 적재(--extract): 기사마다 고치기(checks.fix_row) → 여러 지역(regions) → 검사(checks.violations).
  보류(지역을 못 정함) · 위반 · 정제 기사 없음은 넣지 않고 이유별로 센다.
  이미 있는 기사는 요약을 null 로 덮지 않는다(기사 계약 v0.3). 새 위치가 none 이면 이미 있는
  행의 위치 칸은 그대로
- 장소 확인: 적재 전에 장소 주소(JUSO)로 지역을 바로잡는다(place_check — 구추측 · SIDO → NAT).
  .env 에 JUSO_SEARCH_KEY 가 없으면 건너뛰고 place_check.off 에 남긴다
- 위치: 장소 도로명주소 → 건물 좌표, 못 찾으면 행정 구역 중심 · 시도 대표점(locate, SGIS).
  .env 에 SGIS_KEY · SGIS_SECRET 이 없으면 건너뛰고(위치 none) locate.off 에 남긴다
- 위치 다시 정하기(--relocate): place_id 가 법정동 kr-<10> 인 기사(2026-11-01 lab 적재)를
  저장된 주소로 SGIS 에 다시 찍어 그 점이 든 행정동 kr-<8>(없으면 시군구 kr-<5>)로.
  좌표 · 주소는 그대로
- 본문 지우기(--delete-bodies): news_event 요약이 checks.good_summary 인 기사만
  raw_record 본문 3칸을 null, storage_scope = metadata (기사 계약 v0.3 「본문 지우기」).
  정제 표의 본문은 다음 refine 이 지운다
추출 결과 한 줄: {id, sigungu(지역 이름 체계), summary, event_start, event_end, time_precision,
mentions?}. mentions 는 --mentions 파일({id, mentions})로 따로 줘도 된다
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from pipeline.collect.lofin import connect_from_env

from . import locate, place_check
from .checks import COPIED_PREFIX, SUMMARY_LENGTH, fix_row, good_summary, violations
from .juso import Juso
from .labels import split_region
from .regions import regions
from .sgis import Sgis

ARTICLES = """
SELECT DISTINCT ON (news_id) news_id, title, body, published_at
FROM (
    SELECT n.record -> 'locator' ->> 'news_id' AS news_id,
           n.record -> 'document' ->> 'title' AS title,
           n.record -> 'document' ->> 'body' AS body,
           n.record ->> 'published_at' AS published_at, n.refined_at, n.id
    FROM normalized_ready n
    WHERE n.record -> 'document' ->> 'kind' = 'news'
      AND n.record -> 'locator' ->> 'news_id' = ANY(%s)
) a
ORDER BY news_id, refined_at DESC, id DESC
"""
UPSERT = """
INSERT INTO news_event (news_id, summary, event_start, event_end, time_precision,
                        place_name, address, geometry, location_precision, place_id,
                        sido, sigun, gu, regions, prompt_version, summary_version, model)
VALUES (%(news_id)s, %(summary)s, %(event_start)s, %(event_end)s, %(time_precision)s,
        %(place_name)s, %(address)s,
        ST_SetSRID(ST_MakePoint(%(lon)s::float8, %(lat)s::float8), 4326)::geography,
        %(location_precision)s, %(place_id)s, %(sido)s, %(sigun)s, %(gu)s, %(regions)s,
        %(prompt_version)s, %(summary_version)s, %(model)s)
ON CONFLICT (news_id) DO UPDATE SET
    summary = COALESCE(EXCLUDED.summary, news_event.summary),
    event_start = EXCLUDED.event_start, event_end = EXCLUDED.event_end,
    time_precision = EXCLUDED.time_precision,
    sido = EXCLUDED.sido, sigun = EXCLUDED.sigun, gu = EXCLUDED.gu, regions = EXCLUDED.regions,
    -- 만든 판: 판을 모르는 추출 결과(옛 파일)로 다시 넣으면 있던 판을 지우지 않는다
    prompt_version = COALESCE(EXCLUDED.prompt_version, news_event.prompt_version),
    summary_version = COALESCE(EXCLUDED.summary_version, news_event.summary_version),
    model = COALESCE(EXCLUDED.model, news_event.model),
    -- 새 위치를 못 정했으면(none · 키 없음) 이미 있는 위치를 지우지 않는다
    place_name = CASE WHEN EXCLUDED.location_precision = 'none'
                      THEN news_event.place_name ELSE EXCLUDED.place_name END,
    address = CASE WHEN EXCLUDED.location_precision = 'none'
                   THEN news_event.address ELSE EXCLUDED.address END,
    geometry = CASE WHEN EXCLUDED.location_precision = 'none'
                    THEN news_event.geometry ELSE EXCLUDED.geometry END,
    place_id = CASE WHEN EXCLUDED.location_precision = 'none'
                    THEN news_event.place_id ELSE EXCLUDED.place_id END,
    location_precision = CASE WHEN EXCLUDED.location_precision = 'none'
                              THEN news_event.location_precision
                              ELSE EXCLUDED.location_precision END
RETURNING (xmax = 0) AS inserted
"""
# 본문 칸이 하나라도 남은 기사 원본과 그 기사의 P3 요약(없으면 null)
BODIES = """
SELECT r.id, coalesce(r.c1_record -> 'document' ->> 'body', r.payload -> 'article' ->> 'body'),
       e.summary
FROM raw_record r
LEFT JOIN news_event e ON e.news_id = r.c1_record -> 'locator' ->> 'news_id'
WHERE r.c1_record -> 'document' ->> 'kind' = 'news'
  AND (r.c1_record -> 'document' ->> 'body' IS NOT NULL
       OR r.payload -> 'article' ->> 'body' IS NOT NULL
       OR r.payload -> 'bigkinds' ->> 'content' IS NOT NULL)
"""
# fetch.status · content_hash 는 그대로 둔다 — 「받았다가 지운 것」의 표시 · 같은 원본 지문
DELETE_BODIES = """
UPDATE raw_record SET
    c1_record = jsonb_set(jsonb_set(c1_record, '{document,body}', 'null'),
                          '{storage_scope}', '"metadata"'),
    payload = jsonb_set(jsonb_set(payload, '{article,body}', 'null', false),
                        '{bigkinds,content}', 'null', false)
WHERE id = ANY(%s)
"""


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def event_row(extracted: dict, title: str, body: str | None, published_at: str | None):
    """추출 결과 한 줄 → (news_event 행, 넣지 않는 이유). 이유가 있으면 행은 None"""
    main = (extracted.get("sigungu") or "").strip()
    labels = regions(main, extracted.get("mentions") or [], title, body or "")
    if not labels:
        return None, "보류"
    sido, sigun, gu = split_region(main)
    row = {
        "news_id": extracted["id"],
        "summary": (extracted.get("summary") or "").strip() or None,
        "event_start": extracted.get("event_start"),
        "event_end": extracted.get("event_end") or None,
        "time_precision": extracted.get("time_precision"),
        **(extracted.get("location") or vars(locate.NONE)),
        "sido": sido,
        "sigun": sigun,
        "gu": gu,
        "regions": labels,
        # 만든 판(V0038) — region-extract 결과 칸. 없으면 null
        "prompt_version": extracted.get("prompt_version") or None,
        "summary_version": extracted.get("summary_version") or None,
        "model": extracted.get("model") or None,
    }
    fix_row(row, published_at)
    if problems := violations(row):
        return None, "위반: " + problems[0]
    return row, None


def load(conn, extracted: list[dict]) -> dict:
    """추출 결과를 news_event 에 넣는다(호출한 쪽 트랜잭션 안에서)"""
    ids = [e["id"] for e in extracted]
    articles = {r[0]: r[1:] for r in conn.execute(ARTICLES, (ids,))}
    stats, skipped = Counter(), Counter()
    with conn.cursor() as cur:
        for e in extracted:
            if e["id"] not in articles:
                skipped["정제 기사 없음"] += 1
                continue
            row, reason = event_row(e, *articles[e["id"]])
            if reason:
                skipped[reason] += 1
                continue
            cur.execute(UPSERT, row | {"regions": Jsonb(row["regions"])})
            stats["inserted" if cur.fetchone()[0] else "updated"] += 1
    return {"input": len(extracted), **stats, "skipped": dict(skipped)}


def delete_bodies(conn) -> dict:
    """요약이 제대로 생긴 기사의 원본 본문을 지운다(호출한 쪽 트랜잭션 안에서)"""
    delete, kept = [], Counter()
    for raw_id, body, summary in conn.execute(BODIES):
        if good_summary(summary, body):
            delete.append(raw_id)
        elif summary is None:
            kept["요약 없음"] += 1
        elif not SUMMARY_LENGTH[0] <= len(summary.strip(" ")) <= SUMMARY_LENGTH[1]:
            kept["요약 길이"] += 1
        else:
            kept[f"요약 앞 {COPIED_PREFIX}자가 본문에 있음"] += 1
    if delete:
        conn.execute(DELETE_BODIES, (delete,))
    return {"deleted": len(delete), "kept": dict(kept)}


def merge_mentions(extracted: list[dict], mentions: list[dict]) -> list[dict]:
    by_id = {m["id"]: m.get("mentions") or [] for m in mentions}
    return [e if "mentions" in e else e | {"mentions": by_id.get(e["id"], [])} for e in extracted]


def main(argv=None, connect=connect_from_env, juso=Juso.from_env, sgis_client=Sgis.from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--db", action="store_true", required=True)
    p.add_argument("--extract", type=Path)
    p.add_argument("--mentions", type=Path)
    p.add_argument("--delete-bodies", action="store_true")
    p.add_argument("--relocate", action="store_true", help="법정동 place_id 를 행정동으로(SGIS)")
    p.add_argument("--apply", action="store_true", help="없으면 시험 실행(되돌림)")
    args = p.parse_args(argv)
    if not (args.extract or args.delete_bodies or args.relocate):
        p.error("--extract · --delete-bodies · --relocate 중 하나는 있어야 한다")
    try:
        extracted = read_jsonl(args.extract) if args.extract else []
        if args.mentions:
            extracted = merge_mentions(extracted, read_jsonl(args.mentions))
        result = {"apply": args.apply}
        if extracted:  # 주소 API 는 DB 트랜잭션 밖에서 부른다
            client = juso()
            lookup = place_check.PlaceLookup(client) if client else None
            extracted, result["place_check"] = place_check.apply(extracted, lookup)
            sgis = sgis_client()
            locator = None
            if sgis:
                with connect() as conn:
                    locator = locate.Locator(sgis, locate.read_refs(conn), lookup)
            extracted, result["locate"] = locate.locate_all(extracted, locator)
        moves = []
        if args.relocate:  # SGIS 도 트랜잭션 밖에서
            sgis = sgis_client()
            if not sgis:
                result["relocate"] = {"off": "SGIS_KEY · SGIS_SECRET 없음"}
            else:
                with connect() as conn:
                    rows = conn.execute(locate.OLD_PLACE_IDS).fetchall()
                    locator = locate.Locator(sgis, locate.read_refs(conn))
                moves, result["relocate"] = locate.relocate_ids(rows, locator)
        with connect() as conn, conn.transaction(force_rollback=not args.apply):
            if args.extract:
                result["load"] = load(conn, extracted)
            if moves:
                with conn.cursor() as cur:
                    cur.executemany(locate.SET_PLACE_ID, moves)
                    result["relocate"]["updated"] = cur.rowcount
            if args.delete_bodies:
                result["delete_bodies"] = delete_bodies(conn)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except psycopg.Error:
        # DSN · SQL 이 담길 수 있는 예외 문구는 출력하지 않는다
        print("REGION_LOAD_DB_ERROR", file=sys.stderr)
    except Exception:
        print("REGION_LOAD_FAILED", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
