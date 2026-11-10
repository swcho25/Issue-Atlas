"""기사 위치(locate) · SGIS 클라이언트: 가짜 SGIS · 가짜 장소 확인으로. 실제 API 는 부르지 않는다."""

import pytest

from pipeline.region.locate import NONE, Location, Locator, locate_all, relocate_ids
from pipeline.region.sgis import Point, Sgis, SgisError, address_candidates

REFS = {
    "sgis": {"36030310": "kr-12130310"},  # SGIS 행정동(통합 전 전남 36) → 행정동 place
    "sido": {
        "광주권": Location("광주광역시", "광주광역시", 126.85, 35.16, "admin_centroid", "kr-29"),
        "OUT:충남": Location("충청남도", "충청남도", 126.8, 36.5, "admin_centroid", "kr-44"),
    },
}
EXPO = Point(127.746, 34.751, "6", "1213012000", "36030310")


class FakeSgis:
    def __init__(self, buildings=None, areas=None, error=None):
        self.buildings, self.areas, self.error, self.asked = buildings or {}, areas or {}, error, []

    def building(self, addr):
        self.asked.append(addr)
        if self.error:
            raise SgisError(self.error)
        return self.buildings.get(addr)

    def search(self, query):
        self.asked.append(query)
        return self.areas.get(query, [])


class FakePlaces:
    """장소 이름 → (도로명주소, (시군구, 읍면동))"""

    def __init__(self, known):
        self.known = known

    def address(self, name, within=""):
        return self.known.get(name, ("", None))[0]

    def lookup(self, name, within=""):
        return self.known.get(name, ("", None))[1]


def row(sigungu, places=(), emd=""):
    return {"id": "n", "sigungu": sigungu, "places": list(places), "emd": emd}


def test_building_address_gives_point_and_administrative_dong():
    places = FakePlaces({"여수세계박람회장": ("여수시 박람회길 1", ("여수시", "덕충동"))})
    loc = Locator(FakeSgis({"여수시 박람회길 1": EXPO}), REFS, places).locate(
        row("여수시", ["여수세계박람회장"]))  # fmt: skip
    assert loc == Location("여수세계박람회장", "전남광주통합특별시 여수시 박람회길 1", 127.746, 34.751,
                           "address", "kr-12130310")  # fmt: skip


def test_no_building_falls_back_to_place_area_then_sigungu_id():
    places = FakePlaces({"소라면 한 공장": ("", ("여수시", "소라면"))})
    area = Point(127.6, 34.8, "4", "12130310", "36030999")  # 행정동 place 가 없는 코드 → 시군구
    sgis = FakeSgis(areas={"전남광주통합특별시 여수시 소라면": [area]})
    loc = Locator(sgis, REFS, places).locate(row("여수시", ["소라면 한 공장"]))
    assert (loc.place_name, loc.location_precision, loc.place_id) == (
        "소라면 한 공장", "admin_centroid", "kr-12130")  # fmt: skip


def test_regions_without_sigungu_use_sido_point_and_nation_has_none():
    sgis = FakeSgis()
    locator = Locator(sgis, REFS, None)
    assert locator.locate(row("광주권")).place_id == "kr-29"
    assert (
        locator.locate(row("OUT:충남", ["천안역"])).place_id == "kr-44"
    )  # 다른 시도 장소는 안 찾음
    assert locator.locate(row("NAT")) == locator.locate(row("보류")) == NONE
    assert locator.locate(row("OUT:충청")) == NONE  # 대표점이 없는 이름
    assert sgis.asked == []


def test_city_point_is_not_used_as_area_centroid():
    sgis = FakeSgis(areas={"전남광주통합특별시 여수시": [Point(127.6, 34.7, "1", "", "")]})
    assert Locator(sgis, REFS, None).locate(row("여수시")) == NONE


def test_locate_all_counts_and_stops_on_key_error():
    rows = [row("광주권"), row("여수시", ["여수세계박람회장"]), row("여수시", ["여수세계박람회장"])]
    places = FakePlaces({"여수세계박람회장": ("여수시 박람회길 1", ("여수시", ""))})
    out, stats = locate_all(rows, Locator(FakeSgis(error="SGIS_-401"), REFS, places))
    assert [r["location"]["location_precision"] for r in out] == ["admin_centroid", "none", "none"]
    assert stats["off"] == "SGIS_-401"
    assert locate_all(rows, None) == (rows, {"off": "SGIS_KEY · SGIS_SECRET 없음"})


def test_sgis_client_token_retry_and_unknown_query():
    calls = []

    def get(url):
        calls.append(url.split("?")[0].rsplit("/", 1)[-1])
        if "authentication" in url:
            return {"errCd": 0, "result": {"accessToken": f"t{len(calls)}", "accessTimeout": 0}}
        if "address=%EC%98%9B" in url:  # 옛 지명
            return {"errCd": -1}
        if calls.count("geocodewgs84.json") == 1:
            return {"errCd": -401}
        return {"errCd": 0, "result": {"resultdata": [
            {"x": "127.7", "y": "34.7", "addr_type": 6, "leg_cd": "1213012000", "adm_cd": "1"}]}}  # fmt: skip

    sgis = Sgis("k", "s", get=get, sleep=lambda s: None, now=lambda: 0)
    assert sgis.search("여수시 박람회길 1") == [Point(127.7, 34.7, "6", "1213012000", "1")]
    assert calls == ["authentication.json", "geocodewgs84.json", "authentication.json",
                     "geocodewgs84.json"]  # fmt: skip
    assert sgis.search("옛 여천시") == []
    with pytest.raises(SgisError):
        Sgis("k", "s", get=lambda url: {"errCd": -401}, sleep=lambda s: None).search("x")


def test_address_candidates_and_from_env(tmp_path):
    assert address_candidates("전남광주통합특별시 여수시 서교1길 28-1 서강동주민자치센터 (서교동)") == [
        "여수시 서교1길 28-1 서강동주민자치센터", "여수시 서교1길 28-1", "여수시 서교1길"]  # fmt: skip
    assert address_candidates("광주광역시 서구 내방로 111")[0] == "광주광역시 서구 내방로 111"
    env = tmp_path / ".env"
    env.write_text("SGIS_KEY=a\nSGIS_SECRET=\n", encoding="utf-8")
    assert Sgis.from_env(env) is None


def test_relocate_ids_moves_legal_dong_to_administrative_dong():
    sgis = FakeSgis(areas={
        "여수시 박람회길 1": [EXPO],  # 건물 주소 → 행정동 place 가 있는 코드
        "전남광주통합특별시 여수시 소라면": [Point(127.6, 34.8, "4", "12130310", "36030999")],
    })  # fmt: skip
    rows = [("a", "전남광주통합특별시 여수시 박람회길 1"), ("b", "전남광주통합특별시 여수시 소라면"),
            ("c", "어디에도 없는 주소")]  # fmt: skip
    moves, stats = relocate_ids(rows, Locator(sgis, REFS))
    assert moves == [("kr-12130310", "a"), ("kr-12130", "b")]
    assert stats == {"candidates": 3, "행정동": 1, "시군구": 1, "못 찾음": 1}

    _, stats = relocate_ids(rows, Locator(FakeSgis(error="SGIS_-401"), REFS))
    assert stats["못 찾음"] == 3


class DownSgis(FakeSgis):
    def search(self, query):
        raise SgisError("SGIS_-401")


def test_relocate_stops_on_key_error():
    moves, stats = relocate_ids([("a", "여수시 박람회길 1"), ("b", "여수시 박람회길 1")],
                                Locator(DownSgis(), REFS))  # fmt: skip
    assert moves == [] and stats["off"] == "SGIS_-401" and stats["못 찾음"] == 2
