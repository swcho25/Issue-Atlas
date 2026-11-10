"""⑤ 반박별 근거 기사 고르기(R3) · 프롬프트 v6 · 결과 retrieval (S15P31C108-326)."""

import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from sklearn.feature_extraction.text import TfidfVectorizer

from ai.argument import gms, retrieve
from ai.argument.phrase import phrase
from ai.argument.prompt import PROMPT_VERSION, SYSTEM, article_sources
from api.main import app

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
CARD = {"card_id": "C1", "card_version": 1, "forbidden_terms": ["확산", "전파", "원인", "효과"]}
# judgment-ready 의 경쟁 설명은 ID 가 없어 R1 · R2 · R3 다
ASKED = ["R1", "R2", "R3"]


def example(name):
    return json.loads((CONTRACTS / "ai/examples" / f"{name}.json").read_text(encoding="utf-8"))


def contract(name):
    schemas = [
        json.loads(p.read_text(encoding="utf-8"))
        for p in [*(CONTRACTS / "c2/schemas").glob("*.json"), *(CONTRACTS / "ai").glob("*.json")]
    ]
    registry = Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in schemas)
    schema = next(s for s in schemas if s["$id"].endswith(f"/ai/{name}.schema.json"))
    return Draft202012Validator(schema, registry=registry)


def test_lexical_similarity_matches_scikit_learn():
    texts = [
        "[fixture] 여수 국가산단 공장 가동 축소로 협력업체 직원  300여 명이 옮겼다.",
        "광양만권 대기  정체로 초미세먼지 농도가 높았다. 대기 정체는 사흘 이어졌다.",
        "AB 측정소를 옮기고 측정 장비를 교체했다",
        "",
        "청년 월세 지원 신청을 받는다",
    ]
    query = "청년 유출·정착의 다른 설명: 산단 · 대형 사업장 고용 변동 (ab 측정소)"
    vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(2, 4), sublinear_tf=True)
    expected = (vectorizer.fit_transform(texts) @ vectorizer.transform([query]).T).toarray()
    got = retrieve.LexicalIndex(texts).similarities(query)
    assert got == pytest.approx(expected.ravel().tolist(), abs=1e-9)
    assert got[3] == 0.0


def search(cosines: dict[str, list[float]], summaries=None, query_text=None):
    """기사 n 건(fx-0 …)과 반박별 코사인. 요약과 질의 낱자가 겹치지 않으면 글자 유사도는 0"""
    count = len(next(iter(cosines.values())))
    summaries = summaries or ["가가가가"] * count
    return {
        "query_version": "rebuttal-query-v1",
        "queries": [{"id": rid, "text": query_text or "나나나"} for rid in cosines],
        "articles": [
            {
                "id": f"fx-{n}",
                "date": "2025-01-0" + str(n % 9 + 1),
                "summary": summaries[n],
                "cosine": {rid: values[n] for rid, values in cosines.items()},
            }
            for n in range(count)
        ],
    }


def test_select_takes_top_five_per_rebuttal_in_rebuttal_order_without_duplicates():
    found = search(
        {
            "R1": [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3],
            "R3": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.95],
            # 모델에 묻지 않는 반박의 질의는 쓰지 않는다
            "X9": [1.0] * 7,
        }
    )
    picked, retrieval = retrieve.select(found, ASKED)
    assert [a["id"] for a in picked] == ["fx-0", "fx-1", "fx-2", "fx-3", "fx-4", "fx-6", "fx-5"]
    assert retrieval["method"] == "rebuttal_r3"
    assert (retrieval["k"], retrieval["candidates"]) == (5, 7)
    assert [(p["rebuttal"], p["rank"], p["source_id"]) for p in retrieval["picked"][:6]] == [
        ("R1", 1, "fx-0"),
        ("R1", 2, "fx-1"),
        ("R1", 3, "fx-2"),
        ("R1", 4, "fx-3"),
        ("R1", 5, "fx-4"),
        ("R3", 1, "fx-6"),
    ]
    # 글자 유사도 0 → score = 0.5 × cosine
    assert retrieval["picked"][0] == {
        "rebuttal": "R1",
        "rank": 1,
        "source_id": "fx-0",
        "score": 0.45,
        "cosine": 0.9,
        "lexical": 0.0,
    }
    assert {p["rebuttal"] for p in retrieval["picked"]} == {"R1", "R3"}


def test_select_averages_cosine_and_lexical_and_breaks_ties_by_id():
    # 코사인이 같으면 질의 낱말이 든 요약이 앞선다. 점수까지 같으면 기사 ID 순
    found = search(
        {"R1": [0.5, 0.5, 0.5]},
        summaries=["산단 공장 휴업", "가가가가", "가가가가"],
        query_text="산단 공장 휴업",
    )
    _, retrieval = retrieve.select(found, ASKED)
    assert [p["source_id"] for p in retrieval["picked"]] == ["fx-0", "fx-1", "fx-2"]
    first = retrieval["picked"][0]
    assert first["lexical"] > 0 and first["score"] == round(0.25 + 0.5 * first["lexical"], 4)


@pytest.mark.parametrize(
    "broken",
    [
        lambda s: s["articles"].append(copy.deepcopy(s["articles"][0])),
        lambda s: s["articles"][1]["cosine"].pop("R1"),
    ],
)
def test_select_refuses_duplicate_articles_and_missing_cosines(broken):
    found = search({"R1": [0.9, 0.8]})
    broken(found)
    with pytest.raises(ValueError):
        retrieve.select(found, ASKED)


def answer(calls):
    def call(system, user):
        calls.append((system, json.loads(user)))
        return json.dumps(
            {
                "claim_value": "increasing",
                "rebuttals": [
                    {"id": rid, "status": "not_found", "note": None, "citations": []}
                    for rid in ASKED
                ],
            }
        )

    return call


TAGGED = article_sources(
    [{"id": "tag-1", "date": "2025-01-01", "summary": "카드 꼬리표 기사다.", "url": None}]
)


def test_phrase_sends_the_picked_articles_and_records_why():
    calls = []
    found = search({"R1": [0.9, 0.1], "R2": [0.2, 0.8], "R3": [0.3, 0.7]})
    found["articles"][0]["summary"] = "산단 공장이 문을 닫았다."
    result = phrase(example("judgment-ready"), TAGGED, CARD, answer(calls), search=found)
    system, sent = calls[0]
    assert system == SYSTEM
    # 꼬리표 기사 대신 반박마다 고른 기사(R1 의 1위 fx-0 이 먼저)
    assert [p["text"] for p in sent["passages"]] == ["산단 공장이 문을 닫았다.", "가가가가"]
    output = result.result()
    assert output["retrieval"]["method"] == "rebuttal_r3"
    assert len(output["retrieval"]["picked"]) == 6
    assert output["prompt_version"] == PROMPT_VERSION == "argument-phrasing-v6"
    contract("phrasing-result").validate(output)


@pytest.mark.parametrize("found", [None, search({"X9": [0.9]})])
def test_phrase_without_usable_search_uses_card_tagged_articles(found):
    calls = []
    result = phrase(example("judgment-ready"), TAGGED, CARD, answer(calls), search=found)
    assert [p["text"] for p in calls[0][1]["passages"]] == ["카드 꼬리표 기사다."]
    assert result.retrieval == {
        "method": "card_tags",
        "query_version": None,
        "k": None,
        "candidates": 1,
        "picked": [],
    }
    contract("phrasing-result").validate(result.result())


def test_phrase_refuses_broken_search_and_skips_without_retrieval():
    calls = []
    found = search({"R1": [0.9, 0.8]})
    found["articles"][0]["cosine"].clear()
    refused = phrase(example("judgment-ready"), TAGGED, CARD, answer(calls), search=found)
    assert (refused.status, refused.reason_code, refused.retrieval) == (
        "failed",
        "INPUT_INVALID",
        None,
    )
    skipped = phrase(example("judgment-insufficient"), TAGGED, CARD, answer(calls), search=found)
    assert (skipped.status, skipped.retrieval) == ("skipped", None)
    assert calls == []
    for result in (refused, skipped):
        contract("phrasing-result").validate(result.result())


def test_prompt_v6_rejects_topic_only_passages():
    rule = next(line for line in SYSTEM.splitlines() if line.startswith("3-1."))
    assert "실제로 일어났다는 사실을 직접 말할 때만" in rule
    assert "지원 사업 · 정책 · 행사 · 계획 · 목표 소개" in rule


def test_api_accepts_rebuttal_search_from_the_contract(monkeypatch):
    calls = []
    monkeypatch.setattr(gms, "generate", answer(calls))
    body = {
        "judgment": example("judgment-ready"),
        "articles": [],
        "card": CARD,
        "rebuttal_search": search({"R1": [0.9], "R2": [0.1], "R3": [0.2]}),
    }
    contract("phrasing-request").validate(body)
    response = TestClient(app).post("/v1/argument/phrase", json=body)
    assert response.status_code == 200
    assert response.json()["retrieval"]["candidates"] == 1
    assert len(calls) == 1
