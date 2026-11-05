"""명시 실행(Docker 필요):
uv --directory engine run pytest tests_postgres/test_syndication_store.py

정제된 기사(normalized_ready)를 읽어 전재 묶음 표(news_syndication, V0047)를
통째로 바꿔 쓰는지 본다.
"""

import json

import pytest
from psycopg.types.json import Jsonb

from pipeline.refine import syndication
from tests_postgres.conftest import fresh_schema


@pytest.fixture
def syndication_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0047__create_news_syndication.sql",
        ),
    )


def news(conn, news_id, title, published_at, kind="news", status="pass"):
    conn.execute(
        "INSERT INTO source (source_id, name, org, license_type, storage_scope)"
        " VALUES ('bigkinds', '빅카인즈', '한국언론진흥재단', 'BIGKINDS-이용약관', 'full')"
        " ON CONFLICT DO NOTHING"
    )
    conn.execute(
        "INSERT INTO source_spec (spec_id, source_id, method, evidence_class)"
        " VALUES ('bigkinds_news', 'bigkinds', 'api', 'documents') ON CONFLICT DO NOTHING"
    )
    conn.execute(
        "INSERT INTO job_run (job_run_id, spec_id, collector_version, started_at)"
        " VALUES ('run-1', 'bigkinds_news', 'test', now()) ON CONFLICT DO NOTHING"
    )
    content_hash = "sha256:" + news_id
    conn.execute(
        "INSERT INTO raw_record (job_run_id, spec_id, raw_url, content_hash, collected_at)"
        " VALUES ('run-1', 'bigkinds_news', 'https://bigkinds.or.kr', %s, now())",
        (content_hash,),
    )
    record = {
        "locator": {"news_id": news_id},
        "published_at": published_at,
        "document": {"kind": kind, "title": title, "body": None},
    }
    conn.execute(
        "INSERT INTO normalized_record (content_hash, source_id, spec_id, place_code_system,"
        " place_code_raw, observed_period_type, storage_scope, validation_status, issues,"
        " rule_version, record)"
        " VALUES (%s, 'bigkinds', 'bigkinds_news', 'source_text', '', 'none', 'full', %s,"
        " '[]', 'p2-test', %s)",
        (content_hash, status, Jsonb(record)),
    )


def test_regroup_replaces_the_whole_table(syndication_db, capsys):
    conn, connect = syndication_db
    news(conn, "a", "광주시, 겨울철 노로바이러스 주의 당부", "2025-12-02T09:00:00+09:00")
    news(conn, "b", "광주시 “겨울철 노로바이러스 주의하세요”", "2025-12-02T11:00:00+09:00")
    news(conn, "c", "여수시, 공공심야어린이병원 운영 종료", "2025-12-01T09:00:00+09:00")
    # 보류된 기사 · 보도자료는 묶지 않는다
    news(
        conn,
        "held",
        "광주시, 겨울철 노로바이러스 주의 당부",
        "2025-12-02T10:00:00+09:00",
        status="held",
    )
    news(
        conn,
        "press",
        "광주시, 겨울철 노로바이러스 주의 당부",
        "2025-12-02T10:00:00+09:00",
        kind="press_release",
    )
    conn.execute(
        "INSERT INTO news_syndication (news_id, group_id, group_size, rule_version)"
        " VALUES ('gone', 'gone', 1, 'syn-0.0')"
    )

    # 시험 실행은 되돌린다
    assert syndication.main(["--db"], connect=connect) == 0
    dry = json.loads(capsys.readouterr().out)
    assert dry == {
        "apply": False,
        "rule_version": "syn-0.1",
        "articles": 3,
        "groups": 2,
        "multi_groups": 1,
        "grouped_articles": 2,
        "largest": 2,
    }
    assert conn.execute("SELECT news_id FROM news_syndication").fetchall() == [("gone",)]

    assert syndication.main(["--db", "--apply"], connect=connect) == 0
    rows = conn.execute(
        "SELECT news_id, group_id, group_size, rule_version FROM news_syndication ORDER BY news_id"
    ).fetchall()
    assert rows == [
        ("a", "a", 2, "syn-0.1"),
        ("b", "a", 2, "syn-0.1"),
        ("c", "c", 1, "syn-0.1"),
    ]
