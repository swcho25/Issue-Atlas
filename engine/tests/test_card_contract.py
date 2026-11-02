"""카드 설계도 · 지표 사전 계약(contracts/cards). 판정 코드(CardRule)가 읽는 값이 대표 결정(2026-11-01)과 같은지 본다."""

import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pipeline.collect.airkorea import AirSpec
from pipeline.collect.bigkinds import NewsQuery
from pipeline.collect.kosis import TABLES
from pipeline.collect.lofin import LofinQuery
from pipeline.collect.press import SITES, PressQuery
from pipeline.collect.youth_policy import PolicyQuery

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "contracts" / "cards"
CARD_IDS = ("C1", "A3")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def validator(name):
    schema = read(CARDS / f"{name}.schema.json")
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


INDICATORS = {i["id"]: i for i in read(CARDS / "indicators.json")["indicators"]}
CARD = {card_id: read(CARDS / f"{card_id}.json") for card_id in CARD_IDS}
SPEC_IDS = {
    *TABLES,
    AirSpec(mode="final", file_name="final.xlsx").spec_id,
    NewsQuery.spec_id,
    PolicyQuery.spec_id,
    LofinQuery.spec_id,
    *(PressQuery(site=site).spec_id for site in SITES),
}


def referenced_indicators(card):
    yield from (item["indicator_id"] for item in card["claim_items"])
    yield card["rule"]["indicator_id"]
    for sources in card["evidence"].values():
        yield from (s["indicator_id"] for s in sources if "indicator_id" in s)


def texts(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for v in value:
            yield from texts(v)
    elif isinstance(value, dict):
        for v in value.values():
            yield from texts(v)


def test_files_pass_their_schemas():
    validator("indicators").validate(read(CARDS / "indicators.json"))
    for card in CARD.values():
        validator("card").validate(card)


@pytest.mark.parametrize("card_id", CARD_IDS)
def test_card_indicators_are_in_the_dictionary(card_id):
    card = CARD[card_id]
    for indicator_id in referenced_indicators(card):
        assert indicator_id in INDICATORS
    for item in card["claim_items"]:
        assert card_id in INDICATORS[item["indicator_id"]]["cards"]
    main = [i["indicator_id"] for i in card["claim_items"] if i["role"] == "main"]
    assert main == [card["rule"]["indicator_id"]]


@pytest.mark.parametrize("card_id", CARD_IDS)
def test_card_sources_are_registered_collectors(card_id):
    for sources in CARD[card_id]["evidence"].values():
        for source in sources:
            assert source["spec_id"] is None or source["spec_id"] in SPEC_IDS


def test_dictionary_owner_and_dependencies_are_known():
    # C3 승인은 added_by_card 카드의 검수 전 지표만 함께 검수한다. 넣은 카드는 그 지표를 쓰는 카드다
    for indicator in INDICATORS.values():
        if "added_by_card" in indicator:
            assert indicator["added_by_card"] in indicator["cards"]
        for key in ("numerator_id", "denominator_id", "base_id"):
            if key in indicator:
                assert indicator[key] in INDICATORS


def test_indicator_shape_fields_go_with_their_shape():
    # C3 저장 트리거(V0029)와 같은 조건: ratio 는 분자 · 분모 · 배수, grade_days 는 기준 지표 · 경계값
    schema = validator("indicators")
    base = INDICATORS["air_pm25"]

    def ok(**extra):
        rows = [base | extra]
        return schema.is_valid({"version": "0.2", "decided_at": "2026-11-01", "indicators": rows})

    ratio = {"numerator_id": "a", "denominator_id": "b", "multiplier": 100}
    assert ok() and ok(shape="flow")
    assert ok(shape="ratio", **ratio)
    assert not ok(shape="ratio", numerator_id="a", denominator_id="b")
    assert not ok(**ratio)
    assert ok(shape="grade_days", base_id="air_pm25", cut=35)
    assert not ok(shape="grade_days", base_id="air_pm25")
    assert not ok(cut=35)


def test_claim_items_are_one_to_three():
    card = CARD["C1"]
    more = card["claim_items"] + [
        {"indicator_id": "population_net_migration_total", "role": "related"},
        {"indicator_id": "population_net_migration_19_34", "role": "related"},
    ]
    assert not validator("card").is_valid(card | {"claim_items": more})


def test_dictionary_sources_match_collectors():
    for indicator in INDICATORS.values():
        source = indicator["source"]
        assert source["spec_id"] in SPEC_IDS
        if source["spec_id"] in TABLES:
            table = TABLES[source["spec_id"]]
            assert source["c1_indicator_id"] == table.indicator_id
            # locator C1 은 지역, C2 부터 dims 순서
            for key, code in source["locator"].items():
                # 코드 목록은 그 코드 값들의 합(SP10 19–39세)
                for one in [code] if isinstance(code, str) else code:
                    assert one in table.dims[int(key[1:]) - 2]


def test_cards_match_db_seed():
    seed = (
        ROOT / "backend/src/main/resources/db/migration/V0013__create_card_catalog.sql"
    ).read_text(encoding="utf-8")
    rows = re.findall(r"\('(\w+)', '([^']+)', '([^']+)', '([^']+)', (\d+), '[^']+'\)", seed)
    assert {r[0]: (r[1], r[2], r[3], int(r[4])) for r in rows} == {
        c["card_id"]: (c["name"], c["domain"], c["parent_question"], c["card_version"])
        for c in CARD.values()
    }


def test_c1_follows_decision_2():
    card = CARD["C1"]
    indicator = INDICATORS["population_net_migration_19_39"]
    assert indicator["source"] == {
        "spec_id": "SP01",
        "c1_indicator_id": "population_net_migration",
        "locator": {"C3": "905"},
    }
    assert indicator["roll"] == {"method": "sum", "min_months": 12}
    assert card["applicability"]["place_level"] == "sigungu"
    assert card["applicability"]["min_complete_years"] == 3
    rule = card["rule"]
    assert (rule["min_years"], rule["thresholds"]) == (3, {})
    assert [(o["when"], o["label"]) for o in rule["outcomes"]] == [
        ("fewer_than_min_years", "근거 부족"),
        ("all_negative_abs_increasing", "청년 순유출 확대"),
        ("all_negative_abs_decreasing", "청년 순유출 축소"),
        ("last_year_positive", "순유입 전환"),
        ("otherwise", "불분명"),
    ]
    assert card["ceiling"] == [
        "떠난 이유",
        "행선지 해석",
        "정책 효과",
        "향후 추세",
        "타 지역과 우열",
    ]


def test_a3_follows_decision_3():
    card = CARD["A3"]
    assert INDICATORS["air_pm25"]["roll"] == {"method": "mean", "min_months": 9}
    assert card["applicability"] == {
        "place_level": "sigungu",
        "min_complete_years": 3,
        "min_stations": 1,
    }
    rule = card["rule"]
    assert rule["min_years"] == 3
    assert rule["thresholds"] == {"worse": 3.0, "better": -3.0, "unit": "µg/m³"}
    assert [(o["when"], o["label"]) for o in rule["outcomes"]] == [
        ("fewer_than_min_years", "근거 부족"),
        ("diff_at_least_worse", "악화"),
        ("diff_at_most_better", "개선"),
        ("otherwise", "불분명"),
    ]
    assert card["ceiling"] == [
        "발생원",
        "건강 영향",
        "정책 효과",
        "기상 요인 분리",
        "측정소 없는 지역으로 일반화",
    ]


@pytest.mark.parametrize("card_id", CARD_IDS)
def test_only_statistics_are_required(card_id):
    required = CARD[card_id]["required_for_claim"]
    assert [kind for kind, r in required.items() if r == "required"] == ["statistics"]


@pytest.mark.parametrize("card_id", CARD_IDS)
def test_banned_words_do_not_appear(card_id):
    # 2026-11-01 결정 5: 「확산」 「전파」는 화면 · 코드 · 문서에서 뺀다. 금지어 목록 자신만 예외
    card = {k: v for k, v in CARD[card_id].items() if k != "forbidden_terms"}
    for text in texts(card):
        assert "확산" not in text and "전파" not in text


def test_youth_population_is_the_sum_of_ages_19_to_39():
    # SP10 1세별 코드: 1005 = 19세, 1201–1605 = 20–39세(observation V0025 대응표와 같다)
    youth = INDICATORS["population_registered_19_39"]
    codes = youth["source"]["locator"]["C2"]
    assert len(codes) == 21 and codes[0] == "1005" and codes[-1] == "1605"
    share = INDICATORS["population_youth_share_19_39"]
    assert (
        share["shape"],
        share["numerator_id"],
        share["denominator_id"],
        share["multiplier"],
    ) == (
        "ratio",
        "population_registered_19_39",
        "population_registered_total",
        100,
    )
    denominators = [s["indicator_id"] for s in CARD["C1"]["evidence"]["denominators"]]
    assert denominators == ["population_registered_19_39", "population_registered_total"]
