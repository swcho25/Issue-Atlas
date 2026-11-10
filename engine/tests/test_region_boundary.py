"""시군구 · 행정동 경계 → 시드 SQL: 가짜 SGIS 로. 실제 API 는 부르지 않는다."""

import pytest

from pipeline.region import boundary
from pipeline.region.sgis import Sgis, SgisError

SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]


def feature(code, ring=SQUARE, name="광주광역시 동구"):
    return {
        "properties": {"adm_cd": code, "adm_nm": name},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


class FakeSgis:
    """(코드, 아래 단계) → feature 목록. 없으면 그 시군구 하나 + 행정동 하나"""

    def __init__(self, answers=None):
        self.answers, self.asked = answers or {}, []

    def boundary(self, adm_cd, year, below=False):
        self.asked.append((adm_cd, year, below))
        if (adm_cd, below) in self.answers:
            return self.answers[(adm_cd, below)]
        return [feature(adm_cd + "510")] if below else [feature(adm_cd)]


def test_simplify_drops_points_within_tolerance_and_keeps_ring_closed():
    ring = [[0, 0], [100, 0], [103, 50], [100, 100], [0, 100], [0, 0]]
    assert boundary.simplify_ring(ring, 10) == SQUARE
    assert boundary.simplify_ring(ring, 1) == ring  # 3 m 벗어난 점은 남는다


def test_simplify_keeps_small_ring_instead_of_erasing_it():
    islet = [[0, 0], [4, 0], [4, 4], [0, 0]]  # 허용 오차보다 작은 섬
    assert boundary.simplify_ring(islet, 10) == islet


def test_shrink_rounds_to_metres_for_polygon_and_multipolygon():
    poly = {"type": "Polygon", "coordinates": [[[0.4, 0.6], [100.2, 0], [100, 99.7], [0, 0]]]}
    assert boundary.shrink(poly, 0)["coordinates"] == [[[0, 1], [100, 0], [100, 100], [0, 0]]]
    multi = {"type": "MultiPolygon", "coordinates": [[SQUARE], [SQUARE]]}
    assert boundary.shrink(multi, 10)["coordinates"] == [[SQUARE], [SQUARE]]
    with pytest.raises(ValueError):
        boundary.shrink({"type": "Point", "coordinates": [0, 0]}, 10)


def test_collect_maps_sgis_codes_to_place_ids_like_v0019():
    sgis = FakeSgis({("24010", True): [feature("24010560", name="광주광역시 동구 계림1동")]})
    rows = boundary.collect(sgis, "2025")
    ids = {r["place_id"]: r["code"] for r in rows}
    assert ids["kr-12210"] == "24010"
    assert ids["kr-12210560"] == "24010560"  # 시군구 place + 읍면동 3자리
    assert ids["kr-12130510"] == "36020510"  # 여수시(통합 전 전남 36)
    assert len(rows) == 12 and ("24010", "2025", True) in sgis.asked


@pytest.mark.parametrize(
    "answers",
    [
        {("24010", False): []},  # 시군구 경계 없음
        {("24010", True): []},  # 행정동 없음
        {("24010", True): [feature("24020560")]},  # 다른 시군구 코드
    ],
)
def test_collect_stops_on_unexpected_answers(answers):
    with pytest.raises(ValueError):
        boundary.collect(FakeSgis(answers), "2025")


def test_sql_transforms_from_utm_k_and_checks_every_place_has_a_boundary():
    sql = boundary.to_sql(boundary.collect(FakeSgis(), "2025"), "2025", 10)
    assert "ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 5179), 4326)" in sql
    assert "('kr-12210', '24010', '{\"type\":\"Polygon\"" in sql
    assert "'sgis_hadmarea', 2025, v.code" in sql
    assert "시군구 6곳 · 행정동 6곳" in sql
    assert "RAISE EXCEPTION" in sql


def test_main_without_key_writes_nothing(tmp_path, capsys):
    out = tmp_path / "seed.sql"
    assert boundary.main(["--year", "2025", "--output", str(out)], sgis_client=lambda: None) == 1
    assert not out.exists()
    assert "SGIS_KEY" in capsys.readouterr().err


def test_main_writes_seed_and_counts(tmp_path, capsys):
    out = tmp_path / "seed.sql"
    args = ["--year", "2025", "--output", str(out)]
    assert boundary.main(args, sgis_client=FakeSgis) == 0
    assert out.read_text(encoding="utf-8").startswith("-- 시군구 · 행정동 경계 시드")
    assert '"sigungu": 6, "emd": 6' in capsys.readouterr().out


def test_sgis_boundary_reads_features_and_raises_on_errors():
    calls = []

    def get(url):
        calls.append(url)
        if "authentication" in url:
            return {"errCd": 0, "result": {"accessToken": "t", "accessTimeout": "9999999999999"}}
        if "adm_cd=99999" in url:
            return {"errCd": -401, "errMsg": "인증 실패"}
        return {"errCd": 0, "features": [feature("24010510")]}

    sgis = Sgis("k", "s", get=get, sleep=lambda _: None, now=lambda: 0)
    assert sgis.boundary("24010", "2025", below=True)[0]["properties"]["adm_cd"] == "24010510"
    assert "low_search=1" in calls[-1] and "year=2025" in calls[-1]
    with pytest.raises(SgisError):
        sgis.boundary("99999", "2025")
