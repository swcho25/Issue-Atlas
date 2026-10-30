"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

P2 로 들어오는 수집기 모두(KOSIS · 에어코리아 측정소 · 확정 · 빅카인즈 · 온통청년)를 한 DB 에 받아
한 번에 정제한다. 수집기마다 따로 보던 정제를 함께 돌려, 섞여도 결과가 그대로인지 본다.
지방재정365(local_expenditure) · 보도자료(press_release)는 전용 표에 바로 저장돼 P2 밖이다.
"""

import copy
from datetime import date

from pipeline.collect.airkorea import AirSpec, measurement_pairs, station_record
from pipeline.collect.airkorea_cli import execute
from pipeline.collect.bigkinds import NewsQuery, NewsStore
from pipeline.collect.bigkinds import collect as collect_news
from pipeline.collect.kosis import Query
from pipeline.collect.run import collect as collect_kosis
from pipeline.collect.store import PostgresStore
from pipeline.collect.youth_policy import PolicyQuery
from pipeline.collect.youth_policy import collect as collect_policies
from pipeline.refine.store import refine_raw
from tests.test_article import Web
from tests.test_collect_airkorea import FINAL, STATIONS, gwangju_station
from tests.test_collect_airkorea import ROWS as AIR_ROWS
from tests.test_collect_bigkinds import Search, news, options
from tests.test_collect_youth_policy import Api, policy
from tests_postgres.test_refine_store import ROWS as KOSIS_ROWS

STATION_ITEMS = (STATIONS[1], gwangju_station())


def stations(items=STATION_ITEMS):
    def loader(spec, run, at):
        for item in items:
            url = "https://apis.data.go.kr/?serviceKey=<KEY>"
            yield item, station_record(item, spec, run, at, url)

    return loader


def measurements(spec, run, at):
    for number, row in enumerate(AIR_ROWS, start=2):
        yield from measurement_pairs(row, "2024년 1월 ", number, spec, run, at)


def collect_all(conn, tmp_path) -> dict:
    """수집기마다 한 번씩 → 새로 저장한 원본 수."""
    store = PostgresStore(conn)
    kosis = collect_kosis(
        Query(regions=("46130",)),
        "fixture",
        store,
        tmp_path / "kosis.json",
        fetch=lambda *a: copy.deepcopy(KOSIS_ROWS),
    )
    station = execute(AirSpec("stations"), store, tmp_path / "stations.json", stations())
    final = execute(FINAL, store, tmp_path / "final.json", measurements)
    # 기사 a 는 본문을 받고, b 는 원문 링크가 없어 본문이 없다
    articles = collect_news(
        NewsQuery(date(2025, 1, 1), date(2025, 1, 2)),
        "key",
        NewsStore(conn),
        fetch=Search({"2025-01-01": [news("a"), news("b", link=None)]}),
        **options(Web()),
    )
    policies = collect_policies(
        PolicyQuery(("12130", "12210")),
        "key",
        store,
        fetch=Api({"12130": [policy("A"), policy("B")], "12210": [policy("A")]}),
        sleep=lambda _: None,
    )
    runs = {
        "S01": kosis,
        "airkorea_station": station,
        "airkorea_final": final,
        "bigkinds": articles,
        "youthcenter": policies,
    }
    return {source: run["inserted"] for source, run in runs.items()}


def ready_by_source(conn) -> dict:
    rows = conn.execute("SELECT source_id, count(*) FROM normalized_ready GROUP BY 1").fetchall()
    return dict(rows)


def test_every_collector_refines_together_and_rerun_changes_nothing(refine_db, tmp_path):
    conn, _ = refine_db
    first = collect_all(conn, tmp_path)
    assert first == {
        "S01": 3,
        "airkorea_station": 2,
        "airkorea_final": 18,
        "bigkinds": 2,
        "youthcenter": 3,
    }

    stats = refine_raw(conn)

    # 본문 없는 기사 b 만 보류(BODY_MISSING, 의도된 규칙). 나머지는 모두 통과
    assert (stats["raw"], stats["skipped"]) == (28, {})
    assert stats["status"] == {"pass": 27, "held": 1}
    held = conn.execute(
        "SELECT source_id, issues FROM normalized_record WHERE validation_status = 'held'"
    ).fetchall()
    assert held == [("bigkinds", [{"code": "BODY_MISSING", "field": "document"}])]
    # 에어코리아 확정 시간값은 normalized_record 가 아니라 월별 표에만 들어간다
    assert ready_by_source(conn) == {
        "S01": 3,
        "airkorea_station": 2,
        "bigkinds": 1,
        "youthcenter": 3,
    }
    assert stats["air_monthly"] > 0 and stats["air_unplaced"] == 0
    before = conn.execute("SELECT * FROM normalized_record ORDER BY content_hash").fetchall()

    # 같은 원천을 다시 받으면 새 원본이 없고, 다시 정제해도 바뀌는 행이 없다
    again = collect_all(conn, tmp_path)
    assert set(again.values()) == {0}
    restats = refine_raw(conn)
    assert (restats["inserted"], restats["updated"], restats["unchanged"]) == (0, 0, 10)
    assert restats["status"] == stats["status"]
    assert restats["air_monthly"] == stats["air_monthly"]
    after = conn.execute("SELECT * FROM normalized_record ORDER BY content_hash").fetchall()
    assert after == before


def test_recollection_with_only_unledgered_fields_changed_stays_ready(refine_db, tmp_path):
    # 원천의 장부 밖 칸만 바뀐 재수집(KOSIS 지역 이름표 · 측정소 측정 항목). 원본은 새로 생기지만
    # 장부 내용이 같아 같은 판의 사본이다. 충돌로 보류하지 않고 늦게 받은 사본이 최신이 된다
    conn, _ = refine_db
    collect_all(conn, tmp_path)
    refine_raw(conn)
    store = PostgresStore(conn)
    renamed = copy.deepcopy(KOSIS_ROWS)
    renamed[0]["C1_NM"] += " (통합)"
    kosis = collect_kosis(
        Query(regions=("46130",)),
        "fixture",
        store,
        tmp_path / "kosis-renamed.json",
        fetch=lambda *a: copy.deepcopy(renamed),
    )
    measured = [item | {"item": "SO2, CO, O3, NO2, PM10, PM2.5, VOC"} for item in STATION_ITEMS]
    station = execute(AirSpec("stations"), store, tmp_path / "s2.json", stations(measured))
    assert (kosis["inserted"], station["inserted"]) == (1, 2)

    stats = refine_raw(conn)

    assert stats["status"] == {"pass": 30, "held": 1}
    assert ready_by_source(conn) == {
        "S01": 3,
        "airkorea_station": 2,
        "bigkinds": 1,
        "youthcenter": 3,
    }
    newest = conn.execute(
        "SELECT n.source_id, count(*) FROM normalized_ready n JOIN raw_record r USING"
        " (content_hash) WHERE r.payload->>'C1_NM' LIKE '%(통합)'"
        " OR r.payload->>'item' LIKE '%VOC' GROUP BY 1"
    ).fetchall()
    assert dict(newest) == {"S01": 1, "airkorea_station": 2}
