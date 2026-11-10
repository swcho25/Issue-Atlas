"""기사 지역 이름 체계 ↔ news_event 지역 칸(시도 · 시군 · 구).

이름 체계는 평가 세트 정답과 같다: '여수시' · '광주 북구'(광주 5개 구) ·
'광주권'(광주, 구 모름) · 'SIDO'(통합시 전체) · 'OUT:충남'(다른 시도) · 'NAT'(전국) ·
'보류'(지역을 못 정함).
"""

SIDO = "전남광주통합특별시"
GJ_GU = ("동구", "서구", "남구", "북구", "광산구")
# 다른 시도 줄임말. news_event.sido 에는 SIDO · 전국 · 이 중 하나만 들어간다
OTHER_SIDO = ("서울", "부산", "대구", "인천", "대전", "울산", "세종", "경기",
              "강원", "충북", "충남", "전북", "경북", "경남", "제주")  # fmt: skip
SIDO_VALUES = frozenset({SIDO, "전국", *OTHER_SIDO})
# 다른 시도 전체 이름 → 줄임말. 옛 이름(강원도 · 전라북도 · 제주도)도 기사에 나온다.
# 지명 사전(places)과 지명 → 지역(regions)이 같이 쓴다 — 행정구역이 바뀌면 여기만 고친다
SIDO_SHORT = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기",
    "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전북특별자치도": "전북", "전라북도": "전북", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주", "제주도": "제주",
}  # fmt: skip
# 우리 지역을 가리키는 시도 이름 (LLM 이 통합 전 이름으로 답하기도 한다)
_OUR_SIDO = {SIDO, "전남광주", "전라남도", "전남", "광주광역시", "광주"}
GJ_NAMES = frozenset({"광주", "광주광역시", "광주시"})  # 광주(구 모름)


def split_region(label: str) -> tuple[str | None, str | None, str | None]:
    """이름 체계 → (시도, 시군, 구). '보류' 는 셋 다 None"""
    if label in ("보류", ""):
        return None, None, None
    if label == "NAT":
        return "전국", None, None
    if label.startswith("OUT:"):
        return label.removeprefix("OUT:"), None, None
    if label == "SIDO":
        return SIDO, None, None
    if label == "광주권":
        return SIDO, "광주", None
    if label.startswith("광주 ") and label.removeprefix("광주 ") in GJ_GU:
        return SIDO, "광주", label.removeprefix("광주 ")
    return SIDO, label, None


def join_region(sido: str | None, sigun: str | None, gu: str | None) -> str:
    """(시도, 시군, 구) → 이름 체계 (split_region 의 반대).
    표기 차이(광산구 · 경상남도)는 LLM 후처리가 맞춘다"""
    sido, sigun, gu = (str(x or "").strip() for x in (sido, sigun, gu))
    if sido in ("전국", "NAT", "") and not sigun:
        return "NAT"
    if sido and sido not in _OUR_SIDO:
        return f"OUT:{sido}"
    if sigun in GJ_NAMES or (not sigun and sido in GJ_NAMES):
        return f"광주 {gu}" if gu else "광주권"
    if sigun:
        return f"광주 {sigun}" if sigun in GJ_GU else sigun
    return "SIDO"
