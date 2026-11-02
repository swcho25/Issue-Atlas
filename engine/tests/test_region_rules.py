"""P3 지역 · 시간 규칙: 이름 체계 · 지명 사전 · 본문 정리 · 여수 지역 (S15P31C108-190).

p3-region-lab 테스트(test_models · test_llm · test_regions)에서 옮겼다.
"""

from pipeline.region.labels import SIDO, join_region, split_region
from pipeline.region.places import load
from pipeline.region.regions import label_of, region_labels, regions
from pipeline.region.text import body_text, strip_title


def labels(main, mentions, title, body=""):
    return region_labels(main, mentions, title, body)


# 이름 체계


def test_이름_체계를_시도_시군_구로_나누고_다시_합친다():
    cases = {
        "NAT": ("전국", None, None),
        "OUT:충남": ("충남", None, None),
        "SIDO": (SIDO, None, None),
        "광주권": (SIDO, "광주", None),
        "광주 북구": (SIDO, "광주", "북구"),
        "여수시": (SIDO, "여수시", None),
    }
    for label, parts in cases.items():
        assert split_region(label) == parts
        assert join_region(*parts) == label
    assert split_region("보류") == (None, None, None)


def test_LLM_이_통합_전_이름으로_답해도_맞춘다():
    assert join_region("광주광역시", "", "광산구") == "광주 광산구"
    assert join_region("전라남도", "여수시", "") == "여수시"
    assert join_region("전남광주통합특별시", "북구", "") == "광주 북구"
    assert join_region("", "", "") == "NAT"


# 지명 사전


def test_지명_사전은_우리_통합시와_다른_시도_시군구를_안다():
    places = load()
    assert places.sgg["여수"] == "여수시"
    assert places.sgg_code["광주 북구"].startswith("12")
    assert any(e.sgg == "광주 광산구" for e in places.emd["지죽동"])
    assert places.other_sgg["천안"] == "충남"
    assert "고성" not in places.other_sgg  # 강원 · 경남 둘 다


# 본문 정리


def test_빅카인즈_본문이_다시_실은_제목을_뗀다():
    assert (
        strip_title("여수 산단. 화재", "여수 산단 화재 22일 오후 불이 났다")
        == "22일 오후 불이 났다"
    )
    assert strip_title("다른 제목", "본문 그대로") == "본문 그대로"


def test_사진_설명과_출처_표시는_본문에서_지운다():
    title = "농촌은 AI 날개 달았는데 어촌은"
    body = (
        "농촌은 AI 날개 달았는데 어촌은 여수의 한 어촌인이 긴급 방류에 참여하고 있다 . 여수시 제공"
        "정부의 '모두의 AI' 기조에 따라 농업 현장이 빠르게 진화하는 반면 어업 분야는 소외되고 있다"
    )
    assert body_text(title, body).startswith("정부의")
    verb = "t 군은 주민 30명에게 장학금을 제공했다고 밝혔다. 지원 대상은 고등학생이며 내년에도 이어간다고 했다."
    assert "제공했다" in body_text("t", verb)  # 동사 「제공했다」는 출처 표시가 아니다


# 여러 지역


def test_지명_하나를_이름_체계로():
    assert label_of("여수", False) == "여수시"
    assert label_of("광주광역시 북구", False) == "광주 북구"
    assert label_of("광산구", False) == "광주 광산구"
    assert label_of("북구", False) is None  # 광주 기사가 아니면 구 이름만으로는 모른다
    assert label_of("북구", True) == "광주 북구"
    assert label_of("광주", False) == "광주권"
    assert label_of("경기 광주", False) == "OUT:경기"
    assert label_of("충청남도", False) == "OUT:충남"
    assert label_of("천안", False) == "OUT:충남"
    assert label_of("고성", False) is None
    assert label_of("조선대학교", False) is None
    assert label_of("포천", False) == "OUT:경기"  # 우리 지역 리 이름(포천리)으로 보지 않는다


def test_대표_지역이_첫_칸이고_다른_지역을_더한다():
    assert labels("여수시", ["여수", "순천"], "여수·순천 청년 일자리 박람회") == [
        "여수시",
        "순천시",
    ]


def test_더한_지역끼리_겹치면_넓은_쪽을_빼고_대표는_남긴다():
    assert labels("광주권", ["광주", "동구", "북구"], "광주 동구·북구 경계 도로 개통") == [
        "광주권",
        "광주 동구",
        "광주 북구",
    ]
    assert labels("여수시", ["여수", "전남광주"], "여수 산단 안전 점검, 전남광주 소방 합동") == [
        "여수시"
    ]
    assert labels(
        "SIDO", ["전남광주", "순천", "영암"], "전남광주교육청, 주말 돌봄 순천·영암 시범"
    ) == [
        "SIDO",
        "순천시",
        "영암군",
    ]
    assert labels("SIDO", ["전남", "광주"], "전남·광주 동반성장협의체") == ["SIDO"]


def test_경기_광주시_기사의_광주는_경기():
    assert labels("OUT:경기", ["광주시"], "광주시, 시청사 내 힐링 맨발길 조성") == ["OUT:경기"]


def test_다른_시도_기사의_읍면동_이름은_우리_지역으로_보지_않는다():
    assert labels("OUT:경기", ["포천", "신북면"], "경기도의원, 포천 신북면 치유의숲 점검") == [
        "OUT:경기"
    ]


def test_부고는_대표_지역만():
    assert labels(
        "NAT", ["서울", "인천", "강원"], "[부고] 홍길동씨 별세 外", "서울 · 인천 · 강원"
    ) == ["NAT"]
    assert labels("여수시", ["여수", "순천"], "[부고] 여수 시민 별세", "순천 장례식장") == [
        "여수시"
    ]


def test_본문_뒤쪽에만_나온_지명은_넣지_않는다():
    body = "가" * 300 + " 순천에서도 비슷한 일이 있었다"
    assert labels("여수시", ["여수", "순천"], "여수 산단 화재", body) == ["여수시"]


def test_전국_답이어도_제목에_다른_지역이_나열되면_그_지역들():
    assert labels("NAT", ["대전", "충남", "전북"], "대전·충남·전북 미세먼지 비상저감조치") == [
        "OUT:대전",
        "OUT:충남",
        "OUT:전북",
    ]
    assert labels("NAT", ["여수", "울산"], "여수·울산 석화 구조조정 지지부진") == [
        "여수시",
        "OUT:울산",
    ]
    assert labels("NAT", ["서울", "충남"], "로또당첨번호 조회", "서울 · 충남 판매점에서 1등") == [
        "NAT"
    ]


def test_전국으로_남는_기사():
    assert labels("NAT", ["서울", "강릉"], "[라인W 날씨] 주말 서울 29도, 강릉 26도") == ["NAT"]
    assert labels("NAT", ["서울", "광주"], "[내일 날씨] 전국 비…서울 22도·광주 25도") == ["NAT"]
    assert labels("NAT", ["서울"], "국회 예산 심사, 서울서 공청회") == ["NAT"]
    assert labels("NAT", [], "코스피 하락 마감") == ["NAT"]


def test_더한_지역이_5곳_이상이면_대표_지역만():
    gu = ["동구", "서구", "남구", "북구", "광산구"]
    assert labels("광주권", ["광주", *gu], "광주 동구·서구·남구·북구·광산구 구청장협의회") == [
        "광주권"
    ]
    sigun = ["여수", "순천", "목포", "광양", "나주"]
    assert labels("SIDO", sigun, "여수·순천·목포·광양·나주 폭염주의보") == ["SIDO"]
    assert labels("SIDO", sigun[:4], "여수·순천·목포·광양 폭염주의보") == [
        "SIDO",
        "여수시",
        "순천시",
        "목포시",
        "광양시",
    ]


def test_전국_최초는_전국_명시가_아니다():
    assert labels(
        "광주 북구", ["광주", "북구", "광산구"], "광주 북구·광산구, 전국 최초 공동 조례"
    ) == [
        "광주 북구",
        "광주 광산구",
    ]


def test_보류는_빈_배열이고_regions는_시도_시군_구_칸():
    assert labels("보류", ["여수"], "여수") == []
    assert regions("광주권", ["광주"], "광주 소식", "") == [
        {"sido": SIDO, "sigun": "광주", "gu": None}
    ]
