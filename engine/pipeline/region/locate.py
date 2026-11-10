"""기사 위치 — 장소 이름 → 도로명주소 → 좌표, 못 찾으면 행정 구역 중심 (적재 직전, region-load).

p3-region-lab region_lab/dump.py(Locator)에서 옮겼다 (S15P31C108-206). 「지명 → 상세 주소」 순:
1. 장소(places) 중 도로명주소(JUSO)를 찾고 SGIS 가 건물 단위로 찍은 첫 장소 → address
2. 그런 장소가 없으면 첫 장소가 있는 읍면동 · 시군구, 그다음 기사 읍면동 · 시군구 중심(SGIS)
   → admin_centroid
3. 시군구가 없는 기사(광주권 · 통합시 전체 · 다른 시도) → DB 시도 대표점(level = sido, V0018)
4. 전국 · 보류 · 대표점이 없는 시도 → none
place_id: 좌표가 든 행정동(SGIS 행정동 코드 → place_code_map sgis → kr-<8>, V0019).
행정동 place 가 없는 시군구면 시군구 kr-<5>, 시도 대표점이면 kr-<2>. 법정동 kr-<10> 은 더
만들지 않는다(contracts/p3 「아직 없는 것」, 법정동 하나가 행정동 여럿에 걸친다).
좌표 출처: 통계청 SGIS
"""

from dataclasses import dataclass, replace

from .labels import SIDO
from .places import by_code, load
from .sgis import Point, SgisError, address_candidates

CENTROID_TYPES = {"2", "3", "4", "5"}  # 시군구 ~ 읍면동 중심. 시도 중심(1)은 쓰지 않는다
REFS = """
SELECT 'sgis', place_code, place_id, NULL, NULL, NULL
FROM place_code_map WHERE code_system = 'sgis'
UNION ALL
SELECT 'sido', coalesce(attrs ->> 'sigun', ''), place_id, attrs ->> 'sido', name,
       ST_X(geometry::geometry) || ',' || ST_Y(geometry::geometry)
FROM place WHERE level = 'sido' AND attrs ->> 'sido' IS NOT NULL AND geometry IS NOT NULL
"""


@dataclass(frozen=True)
class Location:
    place_name: str | None = None
    address: str | None = None
    lon: float | None = None
    lat: float | None = None
    location_precision: str = "none"
    place_id: str | None = None


NONE = Location()


def read_refs(conn) -> dict:
    """DB 에서: SGIS 행정동 코드 → place_id, 기사 지역(OUT:충남 · 광주권 · SIDO) → 시도 대표점"""
    refs: dict = {"sgis": {}, "sido": {}}
    for kind, code, place_id, sido, name, xy in conn.execute(REFS):
        if kind == "sgis":
            refs["sgis"][code] = place_id
            continue
        label = ("광주권" if code == "광주" else "SIDO") if sido == SIDO else f"OUT:{sido}"
        lon, lat = (float(v) for v in xy.split(","))
        refs["sido"][label] = Location(name, name, lon, lat, "admin_centroid", place_id)
    return refs


def in_korea(lon: float, lat: float) -> bool:
    return 124 <= lon <= 132 and 33 <= lat <= 39


def admin_address(sgg: str, emd: str = "") -> str:
    """'광주 북구', '용봉동' → '전남광주통합특별시 북구 용봉동' (SGIS 는 시도를 붙여야 행정
    이름을 찾는다)"""
    return " ".join(x for x in (SIDO, sgg.removeprefix("광주 "), emd) if x)


def unified_address(addr: str) -> str:
    """장소 사전의 옛 시도 주소('광주광역시 동구 …' · '순천시 …')를 통합 뒤 표기로"""
    if addr.startswith(SIDO):
        return addr
    return f"{SIDO} {addr.removeprefix('광주광역시 ').removeprefix('전라남도 ')}"


class Locator:
    """장소 확인(PlaceLookup, 없으면 장소 주소를 찾지 않음) · SGIS · DB 참조로 위치를 정한다.
    SGIS 결과는 검색어마다 한 번만 묻는다"""

    def __init__(self, sgis, refs: dict, places=None):
        self.sgis, self.refs, self.places = sgis, refs, places
        self.cache: dict[str, Point | None] = {}

    def place_id(self, point: Point) -> str | None:
        """좌표가 든 행정동 kr-<8>, 행정동 place 가 없으면 시군구 kr-<5>. 우리 통합시 밖이면 None"""
        if pid := self.refs["sgis"].get(point.adm_cd):
            return pid
        leg = point.leg_cd + "00" if len(point.leg_cd) == 8 else point.leg_cd
        sgg = by_code(leg)[0]
        return f"kr-{load().sgg_code[sgg][:5]}" if sgg else None

    def point_of(self, address: str) -> Point | None:
        """주소(건물 주소 · 행정 주소) → SGIS 첫 결과 점. 주소 그대로 먼저(행정 주소는 시도를 붙여야
        찾는다), 그다음 건물 주소 검색어 후보를 차례로"""
        for query in dict.fromkeys([address, *address_candidates(address)]):
            key = (
                "point|" + query
            )  # 위치 정하기의 중심 찾기(검색어 그대로가 키)와 거르는 기준이 다르다
            if key not in self.cache:
                points = self.sgis.search(query)
                first = points[0] if points else None
                self.cache[key] = first if first and in_korea(first.lon, first.lat) else None
            if self.cache[key]:
                return self.cache[key]
        return None

    def _building(self, road_addr: str) -> Point | None:
        key = "building|" + road_addr
        if key not in self.cache:
            point = self.sgis.building(road_addr)
            self.cache[key] = point if point and in_korea(point.lon, point.lat) else None
        return self.cache[key]

    def _centroid(self, sgg: str, emd: str) -> Point | None:
        """시군구 · 읍면동 중심. 우리 통합시 시군구만"""
        if sgg not in load().sgg_code:
            return None
        query = admin_address(sgg, emd)
        if query not in self.cache:
            points = self.sgis.search(query)
            first = points[0] if points else None
            ok = first and first.addr_type in CENTROID_TYPES and in_korea(first.lon, first.lat)
            self.cache[query] = first if ok else None
        return self.cache[query]

    def _admin(self, sgg: str, emd: str, name: str | None) -> Location | None:
        """읍면동 중심, 못 찾으면 시군구 중심"""
        for e in dict.fromkeys((emd, "")):
            if point := self._centroid(sgg, e):
                label = " ".join(x for x in (sgg, e) if x)
                return Location(name or label, admin_address(sgg, e), point.lon, point.lat,
                                "admin_centroid", self.place_id(point))  # fmt: skip
        return None

    def locate(self, row: dict) -> Location:
        """추출 결과 한 줄(지역 이름 체계 sigungu · emd · places) → 위치"""
        sgg, emd = row.get("sigungu") or "", row.get("emd") or ""
        if sgg in ("NAT", "보류", ""):
            return NONE
        if sgg.startswith("OUT:"):  # 다른 시도 기사의 장소는 뽑지 않는다
            return self.refs["sido"].get(sgg, NONE)
        places = [p for p in row.get("places") or [] if p]
        within = "" if sgg == "SIDO" else sgg
        for name in places:
            addr = self.places.address(name, within) if self.places else ""
            if addr and (point := self._building(addr)):
                return Location(name, unified_address(addr), point.lon, point.lat, "address",
                                self.place_id(point))  # fmt: skip
        name = places[0] if places else None
        where = (self.places.lookup(name, within) if self.places and name else None) or ("", "")
        for s, e in (where, (sgg, emd)):
            if found := self._admin(s, e, name):
                return found
        hit = self.refs["sido"].get(sgg)
        return replace(hit, place_name=name or hit.place_name) if hit else NONE


def locate_all(rows: list[dict], locator: Locator | None) -> tuple[list[dict], dict]:
    """추출 결과마다 위치(location 칸)를 붙인 새 목록과 정밀도별 건수. locator 가 없으면(키
    없음) 그대로"""
    if locator is None:
        return rows, {"off": "SGIS_KEY · SGIS_SECRET 없음"}
    out, counts, error = [], {}, ""
    for row in rows:
        try:
            loc = NONE if error else locator.locate(row)
        except SgisError as exc:  # 키 · 시스템 오류 — 이 뒤로는 위치를 정하지 않는다
            error, loc = str(exc), NONE
        counts[loc.location_precision] = counts.get(loc.location_precision, 0) + 1
        out.append(row | {"location": vars(loc)})
    stats = {"precision": counts, "searches": len(locator.cache)}
    if error:
        stats["off"] = error
    return out, stats


# 이미 넣은 기사 중 place_id 가 법정동 kr-<10>(2026-11-01 lab 적재)인 것.
# 주소는 건물 주소 · 행정 주소
OLD_PLACE_IDS = """
SELECT news_id, address FROM news_event
WHERE place_id ~ '^kr-[0-9]{10}$' AND address IS NOT NULL
ORDER BY news_id
"""
SET_PLACE_ID = """
UPDATE news_event SET place_id = %s WHERE news_id = %s AND place_id ~ '^kr-[0-9]{10}$'
"""


def relocate_ids(rows: list[tuple[str, str]], locator: Locator) -> tuple[list[tuple], dict]:
    """(news_id, 주소)마다 주소를 SGIS 로 다시 찍어 그 점이 든 행정동 kr-<8>(없으면 시군구 kr-<5>).
    좌표 · 주소는 바꾸지 않는다 — lab 적재도 같은 SGIS 로 찍은 점이다. 못 찾으면 그대로 둔다"""
    updates, counts, error = [], {"행정동": 0, "시군구": 0, "못 찾음": 0}, ""
    for news_id, address in rows:
        try:
            point = None if error else locator.point_of(address)
        except SgisError as exc:
            error, point = str(exc), None
        place_id = locator.place_id(point) if point else None
        if not place_id:
            counts["못 찾음"] += 1
            continue
        counts["행정동" if len(place_id) == len("kr-12210560") else "시군구"] += 1
        updates.append((place_id, news_id))
    stats = {"candidates": len(rows), **counts}
    if error:
        stats["off"] = error
    return updates, stats
