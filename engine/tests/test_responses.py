"""온통청년 정책 · 세출 한 줄 → 기존 대응 후보. DB 없음."""

from datetime import date

from pipeline.responses.extract import from_expenditure, from_policy
from tests.test_collect_youth_policy import policy

HASH = "sha256:" + "a" * 64


def candidate(code="12130", place="kr-12130", **changes):
    return from_policy(HASH, {"youthcenter": policy("P1", **changes)}, code, place)


def test_policy_of_the_place_itself_maps_source_fields():
    found = candidate(
        sprvsnInstCdNm="전남광주통합특별시 여수시 기획경제국",
        sprtTrgtMinAge="18",
        sprtTrgtMaxAge="39",
    )
    assert found["card_id"] == "C1"
    assert (found["origin_ref"], found["raw_content_hash"]) == ("P1:12130", HASH)
    assert found["department"] == "전남광주통합특별시 여수시 기획경제국"
    # 원천 종료일(그날 포함) → [start, end)
    assert (found["period_start"], found["period_end"]) == (date(2025, 1, 1), date(2026, 1, 1))
    assert found["target"] == "만 18~39세"
    assert found["extracted_by"] == "rule"
    assert found["field_sources"]["department"] == "sprvsnInstCdNm"
    assert "여수시 기획경제국" in found["selection_reason"]


def test_policies_of_others_in_the_query_region_are_not_candidates():
    # 조회 지역 = 대상 지역일 뿐 주관기관 소재지가 아니다
    for issuer in ("국토교통부", "전남광주통합특별시", "전남광주통합특별시 북구", "남동구", ""):
        assert candidate(sprvsnInstCdNm=issuer) is None
    # 광주 북구 조회에는 북구 정책만
    gu = candidate("12300", "kr-12300", sprvsnInstCdNm="전남광주통합특별시 북구")
    assert gu["place_id"] == "kr-12300"
    assert candidate("12300", sprvsnInstCdNm="광주광역시 북구청년과") is None


def test_missing_source_values_stay_missing():
    found = candidate(
        sprvsnInstCdNm="전라남도 여수시",
        bizPrdBgngYmd="        ",
        bizPrdEndYmd="20261231",
        sprtTrgtMinAge="0",
        sprtTrgtMaxAge="0",
    )
    assert (found["period_start"], found["period_end"]) == (None, date(2027, 1, 1))
    assert found["target"] is None and found["field_sources"]["target"] is None
    # 끝이 시작보다 앞이면 기간을 믿지 않는다
    reversed_ = candidate(
        sprvsnInstCdNm="전라남도 여수시", bizPrdBgngYmd="20261231", bizPrdEndYmd="20260101"
    )
    assert (reversed_["period_start"], reversed_["period_end"]) == (date(2026, 12, 31), None)


def test_expenditure_picks_cards_by_attached_keywords_only():
    eid = "sha256:" + "b" * 64
    youth = from_expenditure(eid, 2024, "46130", "kr-12130", "청년 월세 지원")
    assert [(c["card_id"], c["selection_reason"]) for c in youth] == [
        ("C1", "세부사업명에 「청년」")
    ]
    assert youth[0]["fiscal_year"] == 2024 and youth[0]["expenditure_id"] == eid
    # 세출에는 부서 · 대상 · 사업 기간이 없다. 회계연도를 기간으로 쓰지 않는다
    assert youth[0]["department"] is youth[0]["target"] is youth[0]["period_start"] is None
    assert [c["card_id"] for c in from_expenditure(eid, 2024, "29", None, "미세먼지 저감")] == [
        "A3"
    ]
    assert from_expenditure(eid, 2024, "29", None, "신재생에너지확대기반조성") == []
    both = from_expenditure(eid, 2024, "29200", "kr-12330", "청년 대기환경 감시단")
    assert [c["card_id"] for c in both] == ["C1", "A3"]
    assert len({c["response_id"] for c in both}) == 2
