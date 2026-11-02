"""P3 적재 전 고치기 · 검사, 본문을 지워도 되는 요약 (S15P31C108-190)."""

from pipeline.region.checks import fix_row, good_summary, violations
from pipeline.region.labels import SIDO

PUBLISHED = "2025-03-11T09:30:00+09:00"


def row(**changes):
    base = {
        "news_id": "01100101.20250311093000001",
        "summary": "여수 국가산단 공장에서 불이 나 2명이 다쳤다.",
        "event_start": "2025-03-11T00:00:00+09:00",
        "event_end": None,
        "time_precision": "day",
        "place_name": "여수국가산업단지",
        "address": "전남광주통합특별시 여수시 …",
        "lon": 127.7,
        "lat": 34.8,
        "location_precision": "address",
        "place_id": "kr-1213012600",
        "sido": SIDO,
        "sigun": "여수시",
        "gu": None,
        "regions": [{"sido": SIDO, "sigun": "여수시", "gu": None}],
    }
    return {**base, **changes}


def test_분석_기간_밖_사건은_발행일로():
    r = row(event_start="1984-05-18T00:00:00+09:00", event_end="1984-05-28T00:00:00+09:00")
    assert fix_row(r, PUBLISHED) == ["out_of_window→published"]
    assert (r["event_start"], r["event_end"], r["time_precision"]) == (
        "2025-03-11T00:00:00+09:00",
        None,
        "published",
    )
    assert fix_row(row(event_start="1984-05-18T00:00:00+09:00"), None) == [
        "out_of_window(발행 시각 없음)"
    ]


def test_31일을_넘는_day_는_month():
    r = row(event_start="2025-01-01T00:00:00+09:00", event_end="2026-01-01T00:00:00+09:00")
    assert fix_row(r, PUBLISHED) == ["day→month"]
    assert r["time_precision"] == "month"
    assert fix_row(row(), PUBLISHED) == []


def test_올바른_행은_위반이_없다():
    assert violations(row()) == []
    assert violations(row(lon=None, lat=None, location_precision="none", place_id=None)) == []
    assert violations(row(place_id="kr-12210560")) == []  # 행정동 8자리


def test_위반을_찾는다():
    assert "sido=충청" in violations(
        row(sido="충청", regions=[{"sido": "충청", "sigun": None, "gu": None}])
    )
    assert "좌표와 location_precision 불일치" in violations(row(location_precision="none"))
    assert "좌표가 한국 범위 밖" in violations(row(lon=140.0))
    assert "event_end<=event_start" in violations(row(event_end="2025-03-10T00:00:00+09:00"))
    assert "published인데 event_end 있음" in violations(
        row(time_precision="published", event_end="2025-03-12T00:00:00+09:00")
    )
    assert "place_id 형식=plc_yeosu" in violations(row(place_id="plc_yeosu"))


def test_regions_는_비지_않고_첫_원소가_대표_지역():
    assert violations(row(regions=[])) == ["regions 없음"]
    other = [{"sido": SIDO, "sigun": "순천시", "gu": None}]
    assert violations(row(regions=other)) == ["regions 첫 원소 ≠ 대표 지역"]
    both = [
        {"sido": SIDO, "sigun": "여수시", "gu": None},
        {"sido": "울산", "sigun": None, "gu": None},
    ]
    assert violations(row(regions=both)) == []


def test_본문을_지워도_되는_요약():
    body = "여수 국가산단 공장에서 22일 오후 불이 나 작업자 2명이 다쳤다. 소방당국은 원인을 조사 중이다."
    assert good_summary("여수 국가산단 공장 화재로 작업자 2명이 다쳤다.", body)
    assert not good_summary(None, body)
    assert not good_summary("짧은 요약", body)  # 20자 미만
    assert not good_summary("가" * 301, body)
    # 본문을 그대로 옮긴 요약(앞 60자가 본문에 있음)은 다시 요약한다
    assert not good_summary(body[:80], body)
    assert good_summary(" " + "여수 국가산단 공장 화재로 작업자 2명이 다쳤다." + " ", None)
