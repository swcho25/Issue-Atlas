"""적재 전 장소 확인(place_check) · 주소 API(juso): 가짜 주소 API 로. 실제 API 는 부르지 않는다."""

import pytest

from pipeline.region import place_check
from pipeline.region.juso import Juso, JusoError, exact_matches
from pipeline.region.place_check import PlaceLookup, apply, check
from pipeline.region.places import by_code


class FakeJuso:
    """검색어 → 주소 행. 없는 검색어는 결과 없음. error 가 있으면 그 오류를 낸다"""

    def __init__(self, answers=None, error=None):
        self.answers, self.error, self.asked = answers or {}, error, []

    def search(self, keyword):
        self.asked.append(keyword)
        if self.error:
            raise JusoError(self.error)
        return self.answers.get(keyword, [])


def row(bd, adm):
    return {"bdNm": bd, "admCd": adm, "roadAddr": f"{bd} 주소"}


def guessed(gu="광주 남구", **fields):
    return {"id": "n1", "sigungu": "광주권", "notes": {"구추측": gu}, "places": ["남광주역"],
            "mentions": ["광주"]} | fields  # fmt: skip


def test_old_and_new_legal_dong_codes_give_same_place():
    assert by_code("1213031000") == by_code("4613031000") == ("여수시", "소라면")
    assert by_code("2911010900")[0] == "광주 동구"  # 통합 전 광주 동구 29110 → 12210
    assert by_code("1100000000") == ("", "")  # 우리 통합시 밖


def test_guessed_gu_is_restored_from_place_address():
    # LLM 은 「남광주역」을 이름 때문에 남구로 답했다. 주소는 동구(옛 코드로 와도 같다)
    lookup = PlaceLookup(FakeJuso({"남광주역": [row("남광주역", "2911010900")]}), gazetteer={})
    assert check(guessed(), lookup) == ("광주 동구", "구추측")


def test_city_subject_and_split_places_stay_gwangju():
    lookup = PlaceLookup(FakeJuso({"남광주역": [row("남광주역", "1221010900")]}), gazetteer={})
    city = guessed(notes={"구추측": "광주 남구", "장소확인생략": "광주시·광주 전체가 주인공"})
    assert check(city, lookup) == ("광주권", None)
    split = PlaceLookup(FakeJuso({"남광주역": [row("남광주역", "1221010900"),
                                            row("남광주역", "1227010100")]}), gazetteer={})  # fmt: skip
    assert check(guessed(), split) == ("광주권", None)  # 두 구로 갈리면 추측하지 않는다


def test_sido_to_nat_is_narrowed_by_gazetteer_place():
    gaz = place_check.load_gazetteer()
    addr = "전라남도 영광군 홍농읍 홍농로 846"
    juso = FakeJuso({addr: [row("한빛원자력본부", "1283025000")]})
    nat = {
        "id": "n2",
        "sigungu": "NAT",
        "notes": {"SIDO확인": "SIDO → NAT"},
        "places": ["한빛원전"],
    }
    assert check(nat, PlaceLookup(juso, gaz)) == ("영광군", "SIDO 장소")
    # 다른 시도가 나열돼 전국이 된 기사는 장소로 되돌리지 않는다
    listed = nat | {"notes": {"SIDO확인": "SIDO → NAT (다른 시도 대전·충남)"}}
    assert check(listed, PlaceLookup(juso, gaz)) == ("NAT", None)


def test_admin_names_are_not_searched_and_prefix_is_trusted():
    juso = FakeJuso()
    lookup = PlaceLookup(juso, gazetteer={})
    assert lookup.lookup("광주시청 기후대기정책과") is None and lookup.lookup("여수시") is None
    assert lookup.lookup("보성 조성농공단지") == ("보성군", "")  # 주소는 없어도 이름 앞 시군구
    assert juso.asked == ["보성 조성농공단지"]


def test_apply_counts_changes_and_turns_off_on_key_error():
    rows = [guessed(), {"id": "n3", "sigungu": "여수시", "notes": {}, "places": ["여수국가산단"]}]
    out, stats = apply(
        rows, PlaceLookup(FakeJuso({"남광주역": [row("남광주역", "1221010900")]}), {})
    )
    assert [r["sigungu"] for r in out] == ["광주 동구", "여수시"]
    assert out[0]["notes"]["장소확인"] == "구추측" and stats["changed"] == {"구추측": 1}

    out, stats = apply(rows, PlaceLookup(FakeJuso(error="JUSO_E0001"), {}))
    assert [r["sigungu"] for r in out] == ["광주권", "여수시"] and stats["off"] == "JUSO_E0001"
    assert apply(rows, None) == (rows, {"off": "JUSO_SEARCH_KEY 없음"})


def test_juso_search_errors_and_exact_number():
    def get(url):
        code = "E0006" if "짧" in url or "%EC%A7%A7" in url else "E0001"
        return {"results": {"common": {"errorCode": code, "errorMessage": "x"}, "juso": None}}

    juso = Juso("key", get=get, sleep=lambda s: None)
    assert juso.search("짧") == []  # 검색어 탓 오류는 결과 없음
    with pytest.raises(JusoError):
        juso.search("키 오류")
    rows = [{"rn": "봉선로", "buldMnnm": "1", "buldSlno": "0"},
            {"rn": "봉선로", "buldMnnm": "10", "buldSlno": "0"}]  # fmt: skip
    assert exact_matches("광주 남구 봉선로 1", rows) == rows[:1]


def test_juso_from_env_needs_key(tmp_path):
    env = tmp_path / ".env"
    env.write_text("JUSO_SEARCH_KEY=\n", encoding="utf-8")
    assert Juso.from_env(env) is None
    env.write_text("JUSO_SEARCH_KEY=abc\n", encoding="utf-8")
    assert Juso.from_env(env).key == "abc"
