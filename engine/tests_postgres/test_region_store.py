"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

빅카인즈 기사(raw_record → 정제) → region-export → 추출 결과 region-load → news_event, 본문 지우기.
"""

import json
from datetime import date
from decimal import Decimal

import pytest

from pipeline.collect.bigkinds import NewsQuery, NewsStore, collect
from pipeline.refine.store import refine_raw
from pipeline.region import export, load, locate
from pipeline.region.sgis import Point
from tests.test_article import LINES, Web
from tests.test_collect_bigkinds import Search, news, options
from tests_postgres.conftest import fresh_schema

QUERY = NewsQuery(date(2025, 1, 1), date(2025, 1, 2))
SUMMARY = "가상시 주민등록 인구가 3만 명 아래로 줄어 시가 청년 전입 지원을 늘린다."


@pytest.fixture
def region_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
            "V0016__create_news_event.sql",
            "V0020__add_news_event_regions.sql",
        ),
    )


def articles(conn, ids=("a", "b", "c")):
    """본문을 받은 기사 셋을 장부에 넣고 정제한다"""
    collect(QUERY, "key", NewsStore(conn), fetch=Search({"2025-01-01": [news(i) for i in ids]}),
            **options(Web()))  # fmt: skip
    assert not refine_raw(conn)["skipped"]


def extracted(news_id, **fields):
    return {"id": news_id, "sigungu": "여수시", "summary": SUMMARY,
            "event_start": "2025-01-01T00:00:00+09:00", "event_end": "2025-01-02T00:00:00+09:00",
            "time_precision": "day", "mentions": []} | fields  # fmt: skip


def exported(conn, tmp_path):
    out = tmp_path / "articles.jsonl"
    stats = export.export(conn, out)
    return stats, [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines()]


def test_export_load_and_delete_bodies(region_db, tmp_path):
    conn, _ = region_db
    articles(conn)
    stats, rows = exported(conn, tmp_path)
    assert stats["exported"] == 3 and stats["skipped"] == {
        "loaded": 0,
        "no_body": 0,
        "duplicate": 0,
    }
    assert set(rows[0]) == {"id", "title", "lead", "published_at", "source"}
    assert LINES[0] in rows[0]["lead"]

    # 시험 실행은 되돌린다 — 같은 트랜잭션에서 세어 보기만
    with conn.transaction(force_rollback=True):
        assert load.load(conn, [extracted("a")])["inserted"] == 1
    assert conn.execute("SELECT count(*) FROM news_event").fetchone() == (0,)

    copied = extracted("b", summary=LINES[1])  # 본문 문장을 그대로 옮긴 요약
    result = load.load(conn, [extracted("a"), copied, extracted("c", sigungu="보류"),
                              extracted("x")])  # fmt: skip
    assert result["inserted"] == 2
    assert result["skipped"] == {"보류": 1, "정제 기사 없음": 1}
    row = conn.execute(
        "SELECT sido, sigun, regions, location_precision, place_id"
        " FROM news_event WHERE news_id = 'a'"
    ).fetchone()
    yeosu = {"sido": "전남광주통합특별시", "sigun": "여수시", "gu": None}
    assert row == ("전남광주통합특별시", "여수시", [yeosu], "none", None)

    # 다시 넣어도 요약을 null 로 덮지 않는다. 위치 칸은 건드리지 않는다
    conn.execute("UPDATE news_event SET place_id = 'kr-12130' WHERE news_id = 'a'")
    again = load.load(conn, [extracted("a", summary=None, time_precision="month")])
    assert again["updated"] == 1
    assert conn.execute(
        "SELECT summary, time_precision, place_id FROM news_event WHERE news_id = 'a'"
    ).fetchone() == (SUMMARY, "month", "kr-12130")

    stats, rows = exported(conn, tmp_path)
    assert [r["id"] for r in rows] == ["c"] and stats["skipped"]["loaded"] == 2

    # 요약이 제대로 생긴 a 만 지운다. b 는 본문을 옮긴 요약, c 는 요약 없음
    deleted = load.delete_bodies(conn)
    assert deleted == {"deleted": 1,
                       "kept": {"요약 앞 60자가 본문에 있음": 1, "요약 없음": 1}}  # fmt: skip
    raw = conn.execute(
        "SELECT c1_record #> '{document,body}', c1_record ->> 'storage_scope',"
        " c1_record #>> '{document,fetch,status}', c1_record ->> 'content_hash' = content_hash,"
        " payload #> '{article,body}', payload #> '{bigkinds,content}'"
        " FROM raw_record WHERE c1_record #>> '{locator,news_id}' = 'a'"
    ).fetchone()
    assert raw == (None, "metadata", "ok", True, None, None)
    assert load.delete_bodies(conn) == deleted | {"deleted": 0}

    # 다음 정제가 정제 표의 본문도 지운다. 지운 기사는 다시 내보내지 않는다
    refine_raw(conn)
    body = conn.execute(
        "SELECT record #> '{document,body}' FROM normalized_ready"
        " WHERE record #>> '{locator,news_id}' = 'a'"
    ).fetchone()
    assert body == (None,)
    assert [r["id"] for r in exported(conn, tmp_path)[1]] == ["c"]


def test_main_is_dry_run_unless_apply(region_db, tmp_path, capsys):
    conn, connect = region_db
    articles(conn, ("a",))
    path = tmp_path / "extract.jsonl"
    path.write_text(json.dumps(extracted("a"), ensure_ascii=False) + "\n", encoding="utf-8")
    args = ["--db", "--extract", str(path), "--delete-bodies"]
    assert load.main(args, connect=connect, juso=lambda: None, sgis_client=lambda: None) == 0
    dry = json.loads(capsys.readouterr().out)
    assert dry["apply"] is False and dry["load"]["inserted"] == 1
    assert dry["place_check"] == {"off": "JUSO_SEARCH_KEY 없음"}
    assert dry["locate"] == {"off": "SGIS_KEY · SGIS_SECRET 없음"}
    assert dry["delete_bodies"]["deleted"] == 1
    assert conn.execute("SELECT count(*) FROM news_event").fetchone() == (0,)

    assert (
        load.main([*args, "--apply"], connect=connect, juso=lambda: None, sgis_client=lambda: None)
        == 0
    )
    assert conn.execute("SELECT count(*) FROM news_event").fetchone() == (1,)
    assert conn.execute(
        "SELECT count(*) FROM raw_record WHERE c1_record #> '{document,body}' = 'null'"
    ).fetchone() == (1,)


YEOSU_POINT = {"place_name": "여수세계박람회장", "address": "전남광주통합특별시 여수시 박람회길 1",
               "lon": 127.746, "lat": 34.751, "location_precision": "address",
               "place_id": "kr-12130310"}  # fmt: skip


def test_location_is_stored_and_kept_when_new_one_is_none(region_db):
    conn, _ = region_db
    articles(conn, ("a",))
    assert load.load(conn, [extracted("a", location=YEOSU_POINT)])["inserted"] == 1
    stored = conn.execute(
        "SELECT place_name, location_precision, place_id,"
        " round(ST_X(geometry::geometry)::numeric, 3), round(ST_Y(geometry::geometry)::numeric, 3)"
        " FROM news_event WHERE news_id = 'a'"
    ).fetchone()
    assert stored == (
        "여수세계박람회장",
        "address",
        "kr-12130310",
        Decimal("127.746"),
        Decimal("34.751"),
    )
    # 다시 넣을 때 위치를 못 정했으면(키 없음 · none) 이미 있는 위치를 지우지 않는다
    load.load(conn, [extracted("a", summary=None)])
    assert conn.execute(
        "SELECT location_precision, place_id FROM news_event WHERE news_id = 'a'"
    ).fetchone() == ("address", "kr-12130310")


@pytest.fixture
def place_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0011__seed_places.sql",
            "V0018__seed_region_code_maps.sql",
            "V0019__seed_emd_places.sql",
        ),
    )


def test_refs_read_sido_points_and_sgis_codes(place_db):
    conn, _ = place_db
    refs = locate.read_refs(conn)
    assert refs["sido"]["광주권"].place_id == "kr-29" and refs["sido"]["SIDO"].place_id == "kr-12"
    assert refs["sido"]["OUT:충남"].place_id == "kr-44"
    assert refs["sido"]["OUT:충남"].location_precision == "admin_centroid"
    # 같은 행정동이 통합 전(광주 24) · 뒤(12) SGIS 코드 둘 다로 잡힌다
    donggu = {code for code, pid in refs["sgis"].items() if pid == "kr-12210560"}
    assert {c[:2] for c in donggu} == {"12", "24"}


class AreaSgis:
    """주소 → 점 하나. 행정동 코드는 refs 에 없어(이 스키마에 V0019 없음) 시군구 kr-<5> 로 간다"""

    def search(self, query):
        if query == "전남광주통합특별시 여수시 소라면":
            return [Point(127.6, 34.8, "4", "12130310", "36030999")]
        return []


def test_relocate_moves_legal_dong_ids_only_when_applied(region_db, capsys):
    conn, connect = region_db
    point = "ST_SetSRID(ST_MakePoint(127.6, 34.8), 4326)::geography"
    conn.execute(
        "INSERT INTO news_event (news_id, event_start, time_precision, place_name, address,"
        " geometry, location_precision, place_id, sido, sigun, regions) VALUES"
        f" ('a', '2025-01-01', 'day', '소라면', '전남광주통합특별시 여수시 소라면', {point},"
        "  'admin_centroid', 'kr-1213031000', '전남광주통합특별시', '여수시', '[]'),"
        f" ('b', '2025-01-01', 'day', '모름', '없는 주소', {point},"
        "  'admin_centroid', 'kr-1213099999', '전남광주통합특별시', '여수시', '[]'),"
        " ('c', '2025-01-01', 'day', NULL, NULL, NULL,"
        "  'none', 'kr-12130', '전남광주통합특별시', '여수시', '[]')"
    )
    run, keys = ["--db", "--relocate"], {"connect": connect, "juso": lambda: None}
    ids = "SELECT news_id, place_id FROM news_event ORDER BY 1"

    assert load.main(run, sgis_client=AreaSgis, **keys) == 0
    dry = json.loads(capsys.readouterr().out)["relocate"]
    assert dry == {"candidates": 2, "행정동": 0, "시군구": 1, "못 찾음": 1, "updated": 1}
    assert conn.execute(ids).fetchall()[0] == ("a", "kr-1213031000")  # 시험 실행은 되돌림

    assert load.main([*run, "--apply"], sgis_client=AreaSgis, **keys) == 0
    capsys.readouterr()
    after = conn.execute(ids).fetchall()
    assert after == [("a", "kr-12130"), ("b", "kr-1213099999"), ("c", "kr-12130")]
    x = "SELECT round(ST_X(geometry::geometry)::numeric, 1) FROM news_event WHERE news_id = 'a'"
    assert conn.execute(x).fetchone() == (Decimal("127.6"),)  # 좌표는 그대로

    assert load.main(run, sgis_client=lambda: None, **keys) == 0
    off = json.loads(capsys.readouterr().out)["relocate"]
    assert off == {"off": "SGIS_KEY · SGIS_SECRET 없음"}
