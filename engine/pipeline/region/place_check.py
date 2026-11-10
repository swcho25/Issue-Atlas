"""LLM 이 뽑은 장소 이름을 주소 API 로 확인해 기사 지역을 바로잡는다 (적재 직전, region-load).

p3-region-lab region_lab/place.py · models/llm.py(check_sido · check_gu)에서 옮겼다
(S15P31C108-203). 추출(region-extract)은 키 없이 돌도록 장소 확인을 뺐고,
그 자리를 notes 에 남겼다. 여기서 되살린다.
- 구추측: LLM 이 글에 없는 광주 구를 답해 광주권으로 둔 기사 → 장소 · 지명이 주소 DB 에서
  광주 한 구로만 나오면 그 구(남광주역 → 동구 학동). 광주시 · 광주 전체가 주인공인 글
  (장소확인생략)은 그대로 광주권
- SIDO → NAT: 통합시 전체 답인데 글에 시군구 이름이 없어 전국으로 둔 기사 → 장소가 우리 지역
  한 시군구로만 나오면 그곳(p8.2, 한빛핵발전소 → 영광군). 광주 구로 나오면 광주권

장소 확인 (p7 · p7.1 · p7.2, 덤프 기사 장소 3,302개 중 주소를 찾은 것 833개)
- 행정 이름 · 누리집 · 사업 · 시청 부서는 장소가 아니다(places.not_a_place)
- 장소 사전(data/place_gazetteer.tsv)을 먼저 본다 — 주소 API 에 건물명으로 안 나오는
  랜드마크 · 구역 · 옛 청사
- 건물명이 이름과 같은 것 → 이름으로 시작하는 것 → 기사 시군구 안의 것 순으로 좁힌다.
  여러 시군구로 갈리면 「광주광역시 북구청」처럼 지역을 붙여 다시 찾되 건물명이 같을 때만
- 주소를 못 찾아도 이름 앞 시군구(「보성 조성농공단지」)는 믿는다
"""

from pathlib import Path

from .juso import JusoError, exact_matches
from .places import _key, by_code, is_admin_name, load, not_a_place, region_of_prefix

GAZETTEER_FILE = Path(__file__).resolve().parent / "data" / "place_gazetteer.tsv"


def load_gazetteer(path: Path = GAZETTEER_FILE) -> dict[str, list[tuple[str, str]]]:
    """이름 → [(도로명주소, 시군구)] (둘 중 하나만 있다)"""
    gaz: dict[str, list[tuple[str, str]]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        names, addr, sgg, *_ = line.split("\t") + ["", "", ""]
        for name in names.split("|"):
            entries = gaz.setdefault(_key(name), [])
            if (addr.strip(), sgg.strip()) not in entries:
                entries.append((addr.strip(), sgg.strip()))
    return gaz


def _region_prefix(within: str) -> str:
    """기사 시군구 → 검색어 앞에 붙일 지역 ('광주 북구' → '광주광역시 북구', '광주권' →
    '광주광역시')"""
    if within in ("광주", "광주권"):
        return "광주광역시"
    if within.startswith("광주 "):
        return "광주광역시 " + within.removeprefix("광주 ")
    return "" if within in ("", "SIDO") else within


def _inside(sgg: str, within: str) -> bool:
    if within in ("광주", "광주권"):
        return sgg.startswith("광주 ")
    if within == "SIDO":
        return bool(sgg)
    return sgg == within


class PlaceLookup:
    """장소 이름 → (시군구, 읍면동). 검색어 · (이름, 기사 시군구)마다 한 번만 묻는다.
    주소 API 가 키 · 시스템 오류를 내면 error 에 남기고 그 뒤로는 확인을 건너뛴다"""

    def __init__(self, juso, gazetteer: dict | None = None):
        self.juso = juso
        self.gazetteer = load_gazetteer() if gazetteer is None else gazetteer
        self.rows: dict[str, list[dict]] = {}
        self.cache: dict[tuple[str, str], tuple[str, str] | None] = {}
        self.error = ""

    def _search(self, query: str) -> list[dict] | None:
        if self.error:
            return None
        if query not in self.rows:
            try:
                self.rows[query] = self.juso.search(query)
            except JusoError as exc:
                self.error = str(exc)
                return None
        return self.rows[query]

    @staticmethod
    def _one(rows: list[dict], name: str, within: str, exact: bool = False):
        """검색 결과에서 (시군구, 읍면동) 하나. exact 면 건물명이 같은 것만 (지역을 붙인 재검색)"""
        same = [r for r in rows if name and _key(r.get("bdNm", "")) == _key(name)]
        if exact and not same:
            return None  # 「광주광역시 광주은행」 → 소촌동지점 같은 오인
        named = [r for r in rows if _key(r.get("bdNm", "")).startswith(_key(name))]
        found = {by_code(r.get("admCd", "")) for r in same or named or rows}
        if within and len({s for s, _ in found}) > 1:
            found = {f for f in found if _inside(f[0], within)}
        sggs = {s for s, _ in found}
        if len(sggs) != 1 or "" in sggs:
            return None
        emds = {e for _, e in found}
        return sggs.pop(), emds.pop() if len(emds) == 1 else ""

    def _from_gazetteer(self, name: str, within: str):
        hits = []
        for addr, sgg in self.gazetteer.get(_key(name), []):
            if sgg:
                hits.append((sgg, ""))
                continue
            rows = self._search(addr)
            if rows is None:
                return None
            if hit := self._one(exact_matches(addr, rows) or rows, "", ""):
                hits.append(hit)
        hits = list(dict.fromkeys(hits))
        if within and len(hits) > 1:
            hits = [h for h in hits if _inside(h[0], within)] or hits
        return hits[0] if len(hits) == 1 else None

    def lookup(self, name: str, within: str = "") -> tuple[str, str] | None:
        """이름 → (시군구, 읍면동). within(기사 시군구 · '광주')이 있으면 갈린 결과를 그 안으로
        좁힌다"""
        if self.error or not_a_place(name):
            return None
        key = (name, within)
        if key not in self.cache:
            hit = self._from_gazetteer(name, within)
            if not hit:
                rows = self._search(name)
                if rows is None:
                    return None
                hit = self._one(rows, name, within) if rows else None
                prefix = _region_prefix(within)
                if not hit and prefix and not _key(name).startswith(_key(prefix)):
                    rows = self._search(f"{prefix} {name}")
                    if rows is None:
                        return None
                    hit = self._one(rows, name, within, exact=True) if rows else None
            if not hit and (sgg := region_of_prefix(name)):
                hit = (sgg, "")  # 주소는 못 찾았지만 이름 앞 시군구는 확실하다 (p7.1)
            self.cache[key] = hit
        return self.cache[key]

    def address(self, name: str, within: str = "") -> str:
        """장소 이름 → 도로명주소 하나(위치 정하기, locate).
        lookup 이 시군구를 정한 장소만, 그 시군구 안의 건물로. 장소 사전에 주소가 있으면 그것,
        아니면 건물명이 같은 결과 → 이름으로 시작하는 결과의 첫 번째.
        캠퍼스처럼 같은 이름 건물이 여럿이면 첫 번째 — 좌표는 그 안의 한 건물이다"""
        hit = self.lookup(name, within)
        if not hit:
            return ""
        sgg = hit[0]
        for addr, _ in self.gazetteer.get(_key(name), []):
            if addr:
                return addr
        prefix = _region_prefix(sgg)
        for query in (name, f"{prefix} {name}" if prefix else ""):
            rows = self._search(query) if query else None
            if not rows:
                continue
            same = [r for r in rows if _key(r.get("bdNm", "")) == _key(name)]
            named = [r for r in rows if _key(r.get("bdNm", "")).startswith(_key(name))]
            inside = [r for r in same or named if by_code(r.get("admCd", ""))[0] == sgg]
            if inside:
                return inside[0].get("roadAddr") or ""
        return ""

    def find_gu(self, names: list) -> tuple[str, str] | None:
        """장소 · 지명들로 광주 구 하나. 서로 다른 구가 나오면 None"""
        hits = set()
        for name in names:
            name = str(name).strip()
            if len(name) < 3 or is_admin_name(name):
                continue  # 행정 이름(광산구 · 여수시)은 장소가 아니다
            hit = self.lookup(name, "광주")
            if hit and hit[0].startswith("광주 "):
                hits.add(hit)
        return hits.pop() if len(hits) == 1 else None

    def sgg_of_places(self, places: list) -> str:
        """장소들이 우리 지역 한 시군구로만 나오면 그 시군구. 광주 구는 광주권(구를 추측하지
        않는다)"""
        sggs = {hit[0] for p in places if (hit := self.lookup(p, ""))}
        sgg = sggs.pop() if len(sggs) == 1 else ""
        if sgg.startswith("광주 "):
            return "광주권"
        return sgg if sgg in load().sgg_code else ""


def check(row: dict, lookup: PlaceLookup) -> tuple[str, str | None]:
    """추출 결과 한 줄 → (기사 지역 이름, 바꾼 까닭). 바꾸지 않으면 (그대로, None)"""
    label, notes = row.get("sigungu") or "", row.get("notes") or {}
    places, mentions = row.get("places") or [], row.get("mentions") or []
    if label == "광주권" and notes.get("구추측") and not notes.get("장소확인생략"):
        if found := lookup.find_gu(places + mentions):
            return found[0], "구추측"
    if label == "NAT" and notes.get("SIDO확인") == "SIDO → NAT" and places:
        if by_place := lookup.sgg_of_places(places):
            return by_place, "SIDO 장소"
    return label, None


def apply(rows: list[dict], lookup: PlaceLookup | None) -> tuple[list[dict], dict]:
    """추출 결과들에 check 를 적용한 새 목록과 건수. lookup 이 없으면(키 없음) 그대로"""
    if lookup is None:
        return rows, {"off": "JUSO_SEARCH_KEY 없음"}
    out, changed = [], {}
    for row in rows:
        label, why = check(row, lookup)
        if why:
            changed[why] = changed.get(why, 0) + 1
            row = row | {"sigungu": label, "notes": (row.get("notes") or {}) | {"장소확인": why}}
        out.append(row)
    stats = {"changed": changed, "searches": len(lookup.rows)}
    if lookup.error:
        stats["off"] = lookup.error  # 이 뒤로는 확인하지 못했다
    return out, stats
