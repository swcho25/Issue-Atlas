"""기사 지역 여러 개(news_event.regions, contracts/p3 v0.4).

대표 지역 + 제목 · 첫 부분에 나온 다른 지역.
- 대표 지역은 LLM 답(평가 세트로 맞춘 것) 그대로, 배열의 첫 칸
- 다른 지역은 LLM 이 뽑은 mentions(글에 나온 지명) 중 제목 · 본문 첫 200자에 나온 것만
  지역으로 바꿔 더한다 (본문에 잠깐 나온 지역 · 사진 설명 · 기자 소속은 넣지 않는다)
- 전국: 대표 답이 전국이면 전국. 다만 「전국」이 없고 **제목에** 다른 지역이 2~4곳 나열되면
  (「대전·충남 미세먼지」 · 「여수·울산 석화」) 그 지역들. 날씨 · 기온 · 로또 기사는 도시를
  나열해도 전국 (정우현 2026-11-01)
- 더한 지역이 5곳 이상이면 대표 지역만(폭염특보 22개 시군 · 구청장협의회 5개 구)
  — 대표 지역이 이미 그 넓이다
- 부고 · 별세 기사는 대표 지역만(장례식장 지역은 기사 지역이 아니다)
- 겹침 정리는 더한 지역에만: 광주 구가 있으면 「광주(구 모름)」를, 통합시 안 시군이 있으면
  「통합시 전체」를 뺀다. 대표가 통합시 전체면 「전남·광주」의 광주도 뺀다
- 지명 → 지역: 우리 시군구 · 읍면동(동 · 읍 · 면으로 끝나는 이름), 광주 · 통합시 이름,
  다른 시도 이름, 다른 시도의 시군구 이름(두 시도 이상에 있는 이름은 쓰지 않는다).
  대표가 경기면 「광주」는 경기 광주시
- 평가 세트 500건 · 서버 기사 3,477건(2026-11-01)에서 검토: 지역 1곳 87% · 2~5곳 13%
"""

import re

from .labels import GJ_GU, split_region
from .places import load
from .text import body_text

HEAD = 200
MANY = 5  # 더한 지역이 이만큼이면 대표 지역만
_SIDO_FULL = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기",
    "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전북특별자치도": "전북", "전라북도": "전북", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주", "제주도": "제주",
}  # fmt: skip
_SIDO_SHORT = set(_SIDO_FULL.values())
_GJ = {"광주", "광주시", "광주광역시"}
_OUR_WHOLE = {"전남광주", "전남광주통합특별시", "통합특별시", "광주전남", "광주·전남", "전남·광주",
              "전남", "전라남도"}  # fmt: skip
_NATION = re.compile(
    r"전국(?!\s?(?:체전|체육대회|소년체전|장애인체전|노래자랑|최초|처음|첫|유일|1위|최대|최고|최다|최저|최소))"
)
_OBITUARY = re.compile(r"\[부고\]|부음|별세|영면")
_NATION_LIST = re.compile(r"날씨|기온|로또")  # 도시를 나열해도 전국인 기사


def label_of(mention: str, gj_context: bool, main: str = "") -> str | None:
    """지명 하나 → 이름 체계(여수시 · 광주 북구 · 광주권 · SIDO · OUT:충남 · NAT). 모르면 None.
    gj_context: 대표 지역이 광주라 「북구」처럼 구 이름만 나와도 광주 구로 볼 때"""
    places = load()
    m = re.sub(r"\s+", " ", str(mention)).strip()
    flat = m.replace(" ", "")
    if not m:
        return None
    if flat in ("전국", "전국적"):
        return "NAT"
    if flat in _OUR_WHOLE:
        return "SIDO"
    if m.startswith("경기 광주") or flat == "경기광주" or (flat in _GJ and main == "OUT:경기"):
        return "OUT:경기"
    if flat in _GJ:
        return "광주권"
    for gu in GJ_GU:
        named = flat in (f"광주{gu}", f"광주광역시{gu}", f"광주시{gu}")
        if named or (flat == gu and (gu == "광산구" or gj_context)):
            return f"광주 {gu}"
    if m in places.sgg_code:
        return m
    if flat in places.sgg:
        return places.sgg[flat]
    if flat in _SIDO_FULL:
        return "OUT:" + _SIDO_FULL[flat]
    if flat in _SIDO_SHORT:
        return "OUT:" + flat
    if flat in places.other_sgg:
        return "OUT:" + places.other_sgg[flat]
    # 우리 지역 읍면동 이름이 한 시군구에만 있을 때. 리 이름은 흔해서, 다른 시도 · 전국 기사는
    # 같은 이름(포천 신북면 · 영암 신북면)이 있어 보지 않는다
    ours = main not in ("NAT", "") and not main.startswith("OUT:")
    if ours and m.endswith(("동", "읍", "면")):
        hits = {e.sgg for e in places.emd.get(m, [])}
        if len(hits) == 1:
            return hits.pop()
    return None


def _tidy(main: str, added: list[str]) -> list[str]:
    """대표 지역 + 더한 지역(겹침 정리는 더한 것에만). 대표가 없으면(전국 대신 나열) 더한 것끼리"""
    out = list(dict.fromkeys(([main] if main else []) + added))
    head, rest = (out[:1], out[1:]) if main else ([], out)
    if main == "SIDO" or any(
        x.startswith("광주 ") for x in out
    ):  # 「전남·광주」의 광주는 통합시 안이다
        rest = [x for x in rest if x != "광주권"]
    if any(x not in ("SIDO", "NAT") and not x.startswith("OUT:") for x in out):
        rest = [x for x in rest if x != "SIDO"]
    return head + rest


def region_labels(main: str, mentions: list, title: str, body: str) -> list[str]:
    """대표 지역(이름 체계) + 제목 · 첫 부분의 다른 지역. 보류면 빈 배열"""
    if main in ("보류", ""):
        return []
    if _OBITUARY.search(title or ""):
        return [main]
    head = f"{title or ''} {body_text(title, body)[:HEAD]}"
    gj = main == "광주권" or main.startswith("광주 ")
    scope = (
        (title or "") if main == "NAT" else head
    )  # 전국 답을 지역으로 바꾸는 것은 제목에 나열된 지역만
    found = []
    for mention in mentions or []:
        name = str(mention).strip()
        if name and name in scope and (label := label_of(name, gj, main)) and label != "NAT":
            found.append(label)
    if main == "NAT":
        others = _tidy("", found)
        listed = 2 <= len(others) < MANY and not _NATION.search(head)
        return others if listed and not _NATION_LIST.search(title or "") else ["NAT"]
    out = _tidy(main, found)
    return out if len(out) - 1 < MANY else [main]


def regions(main: str, mentions: list, title: str, body: str) -> list[dict]:
    """news_event.regions: [{sido, sigun, gu}, …] 첫 칸이 대표 지역"""
    out = []
    for label in region_labels(main, mentions, title, body):
        sido, sigun, gu = split_region(label)
        out.append({"sido": sido, "sigun": sigun, "gu": gu})
    return out
