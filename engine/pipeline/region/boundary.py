"""시군구 · 행정동 경계 → Flyway 시드 SQL (contracts/p3 「경계」).

python -m pipeline.region.boundary --year 2025 --output <V00xx__seed_….sql>   → 건수 JSON

- 출처: 통계청 SGIS 행정구역 경계(/boundary/hadmarea.geojson). 우리 시군구 6곳은 그 구역 하나,
  행정동은 시군구 바로 아래 단계로 받는다
- 좌표는 SGIS 가 주는 UTM-K(EPSG:5179) 를 1 m 로 반올림해 그대로 적고, 마이그레이션이 PostGIS 로
  WGS84 로 바꾼다 — engine 에 좌표 변환 라이브러리를 더하지 않는다
- SGIS 코드 → place_id 는 V0019 와 같은 규칙: 시군구 place 뒤에 읍면동 3자리
- 키: 루트 .env SGIS_KEY · SGIS_SECRET. 없거나 경계가 비면 아무것도 쓰지 않고 1
"""

import argparse
import json
import sys
from pathlib import Path

from pipeline.region.sgis import Sgis

SOURCE = "sgis_hadmarea"
TOLERANCE = 10.0  # m. 화면 테두리 · 행정동 안 점 거르기에 충분하고 여수 섬 해안선을 크게 줄인다
# SGIS 시군구 코드(경계 연도 기준, 통합 전 광주 24 · 전남 36) → 시군구 place (V0024)
SGG = {
    "24010": "kr-12210",  # 광주 동구
    "24020": "kr-12240",  # 광주 서구
    "24030": "kr-12270",  # 광주 남구
    "24040": "kr-12300",  # 광주 북구
    "24050": "kr-12330",  # 광주 광산구
    "36020": "kr-12130",  # 여수시
}


def simplify_ring(ring: list[list[int]], tolerance: float) -> list[list[int]]:
    """Douglas–Peucker. 닫힌 고리(처음 = 끝)를 받아 닫힌 고리로. 4점 미만으로 줄면 원래 고리
    (작은 섬 · 구멍을 지우지 않는다 — 점 거르기에서 빠지지 않게)"""
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = ring[a], ring[b]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5
        far, far_d = -1, tolerance
        for i in range(a + 1, b):
            px, py = ring[i]
            d = (
                abs(dy * (px - ax) - dx * (py - ay)) / norm
                if norm
                else ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            )
            if d > far_d:
                far, far_d = i, d
        if far >= 0:
            keep[far] = True
            stack += [(a, far), (far, b)]
    out = [p for p, k in zip(ring, keep, strict=True) if k]
    return out if len(out) >= 4 else ring


def shrink(geometry: dict, tolerance: float) -> dict:
    """좌표를 1 m 정수로(UTM-K 는 미터) 반올림하고 고리마다 단순화"""

    def ring(r):
        pts = [[round(x), round(y)] for x, y, *_ in r]
        return simplify_ring(pts, tolerance) if tolerance > 0 else pts

    if geometry["type"] == "Polygon":
        coords = [ring(r) for r in geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        coords = [[ring(r) for r in poly] for poly in geometry["coordinates"]]
    else:
        raise ValueError(f"BOUNDARY_GEOMETRY_{geometry['type']}")
    return {"type": geometry["type"], "coordinates": coords}


def collect(sgis, year: str) -> list[dict]:
    """시군구마다 그 구역 하나 + 바로 아래 행정동. 한 행 = {place_id, code, name, geometry}"""
    rows = []
    for sgg, place_id in SGG.items():
        own = sgis.boundary(sgg, year)
        if len(own) != 1:
            raise ValueError(f"BOUNDARY_SGG_{sgg}_{len(own)}")
        rows.append(row(place_id, own[0]))
        below = sgis.boundary(sgg, year, below=True)
        if not below:
            raise ValueError(f"BOUNDARY_EMD_{sgg}_EMPTY")
        for f in below:
            code = str(f["properties"]["adm_cd"])
            if len(code) != 8 or not code.startswith(sgg):
                raise ValueError(f"BOUNDARY_EMD_CODE_{code}")
            rows.append(row(place_id + code[5:], f))
    return rows


def row(place_id: str, feature: dict) -> dict:
    g = feature["geometry"]  # 원본 그대로 — 줄이기는 to_sql 에서
    return {
        "place_id": place_id,
        "code": str(feature["properties"]["adm_cd"]),
        "name": str(feature["properties"].get("adm_nm") or ""),
        "geometry": {"type": g["type"], "coordinates": g["coordinates"]},
    }


def to_sql(rows: list[dict], year: str, tolerance: float) -> str:
    values = ",\n".join(
        f"    ('{r['place_id']}', '{r['code']}', "
        f"'{json.dumps(shrink(r['geometry'], tolerance), separators=(',', ':'))}')"
        for r in rows
    )
    names = ", ".join(f"{r['place_id']} {r['name']}" for r in rows[:2])
    sgg = sum(len(r["code"]) == 5 for r in rows)
    header = "\n".join([
        "-- 시군구 · 행정동 경계 시드(contracts/p3 「경계」).",
        f"-- engine `python -m pipeline.region.boundary --year {year}` 가 만든 파일.",
        f"-- 출처 통계청 SGIS 행정구역 경계 {year}년(/boundary/hadmarea.geojson).",
        f"-- 시군구 {sgg}곳 · 행정동 {len(rows) - sgg}곳.",
        "-- 좌표는 SGIS UTM-K(EPSG:5179) 1 m 정수,",
        f"-- 고리마다 {tolerance:g} m 단순화(Douglas–Peucker).",
        "-- 여기서 WGS84 로 바꾸고, 잘못된 고리는 ST_MakeValid 로 고쳐 다각형만 남긴다.",
        f"-- 행 = (place_id, SGIS 코드, UTM-K GeoJSON). 예: {names}",
    ])  # fmt: skip
    return f"""{header}
INSERT INTO place_boundary (place_id, boundary, source, source_year, source_code)
SELECT v.place_id,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(
           ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 5179), 4326)), 3))::geography,
       '{SOURCE}', {int(year)}, v.code
FROM (VALUES
{values}
) AS v (place_id, code, geojson);

-- 시군구 · 행정동 place 는 모두 경계가 있어야 한다
-- (SGIS 와 V0019 행정동 목록이 다르면 여기서 멈춘다)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM place p
        WHERE p.level IN ('sigungu', 'emd')
          AND NOT EXISTS (SELECT 1 FROM place_boundary b WHERE b.place_id = p.place_id)
    ) THEN
        RAISE EXCEPTION 'place_boundary: 경계 없는 시군구 · 행정동이 있다';
    END IF;
END $$;
"""


def main(argv=None, sgis_client=Sgis.from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--year", required=True, help="SGIS 경계 기준 연도")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--tolerance", type=float, default=TOLERANCE, help="단순화 허용 오차(m)")
    args = p.parse_args(argv)
    sgis = sgis_client()
    if not sgis:
        print("SGIS_KEY · SGIS_SECRET 없음", file=sys.stderr)
        return 1
    try:
        rows = collect(sgis, args.year)
    except Exception as exc:
        # SgisError · ValueError 문구에는 키 · 주소가 없다
        print(f"BOUNDARY_FAILED {type(exc).__name__} {exc}", file=sys.stderr)
        return 1
    args.output.write_text(to_sql(rows, args.year, args.tolerance), encoding="utf-8", newline="\n")
    sgg = sum(len(r["code"]) == 5 for r in rows)
    print(json.dumps({"sigungu": sgg, "emd": len(rows) - sgg, "bytes": args.output.stat().st_size}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
