"""P5 ③ 보증 · ⑤ 반박 문장화. 모델은 가짜로 바꿔 네트워크 없이 돈다. 기사 · A3 개선 입력은 가상이다."""

import copy
import io
import json
from pathlib import Path
from urllib.error import HTTPError

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from ai.argument import gms
from ai.argument.__main__ import main
from ai.argument.check import check
from ai.argument.phrase import phrase
from ai.argument.prompt import article_sources, build, passages
from api.main import app

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
# 카드 승인본(card_version.spec) 중 문장화가 읽는 칸만
C1_CARD = {
    "card_id": "C1",
    "card_version": 1,
    "forbidden_terms": ["확산", "전파", "원인", "효과", "소멸", "탈여수"],
}
A3_CARD = {
    "card_id": "A3",
    "card_version": 1,
    "forbidden_terms": ["확산", "전파", "원인", "효과", "소멸", "오염 유입", "배출원"],
}


def example(name):
    return json.loads((CONTRACTS / "ai/examples" / f"{name}.json").read_text(encoding="utf-8"))


def c1():
    return example("judgment-ready")


def a3():
    """A3 비교 불가 예시를 같은 측정소 개선(끝해 − 첫해 −3.5)으로 바꾼 가상 입력"""
    record = example("judgment-not-comparable")
    record["run_status"] = "ready"
    record["comparability"]["same_boundary"] = {"passed": True, "note": "같은 측정소끼리만 비교"}
    record["claim"] = {
        "value": "decreasing",
        "level": "calculated",
        "text": "여수시의 측정소 1곳에서 2023–2025 초미세먼지(PM2.5) 연평균이 개선.",
        "provenance": "rule",
    }
    for point, value in zip(record["statistics_points"], [18.6, 16.94, 15.1], strict=True):
        point["value"] = value
    return record


ARTICLES = [
    {
        "id": "fx-001",
        "date": "2025-03-04",
        "place_id": "kr-12130",
        "point": None,
        "precision": "none",
        "summary": "[fixture] 여수 국가산단의 한 업체가 공장 가동을 줄였다. 협력업체 직원 300여 명이 다른 지역으로 옮긴 것으로 알려졌다.",
        "place_name": "여수시",
        "url": "https://example.com/news/1",
    },
    {
        "id": "fx-002",
        "date": "2025-05-10",
        "place_id": "kr-12130",
        "point": None,
        "precision": "none",
        "summary": "[fixture] 여수시가 청년 월세 지원 신청을 받는다.",
        "place_name": "여수시",
        "url": None,
    },
]
SOURCES = article_sources(ARTICLES)


def c1_output():
    return {
        "claim_value": "increasing",
        "warrant": {
            "text": "여수시의 청년(19–39세) 순이동은 2023년 -1,850명, 2024년 -2,010명, 2025년 -2,240명으로 "
            "해마다 순유출이 커졌다. 순이동은 정착 여부를 직접 재는 공식 지표라 정착 기반이 약해지는 신호로 본다.",
            "citations": ["ev_kosis_net_yeosu"],
        },
        "rebuttals": [
            {"id": "R1", "status": "not_found", "note": None, "citations": []},
            {"id": "R2", "status": "needs_review", "note": None, "citations": []},
            {
                "id": "R3",
                "status": "supported",
                "note": "산단 업체 가동 축소 뒤 협력업체 직원 300여 명이 옮겼다는 보도가 있다.",
                "citations": [
                    {"passage": "P2", "quote": "협력업체 직원 300여 명이 다른 지역으로 옮긴"}
                ],
            },
        ],
    }


def problems(output, judgment=None, card=C1_CARD):
    return {(p.check, p.where) for p in check(build(judgment or c1(), SOURCES, card), output)}


# ── 입력 ──


def test_passages_split_text_and_keep_source_location():
    found = passages(SOURCES)
    assert [p["id"] for p in found] == ["P1", "P2", "P3"]
    assert found[1]["text"] == "협력업체 직원 300여 명이 다른 지역으로 옮긴 것으로 알려졌다."
    assert found[1]["locator"] == {
        "kind": "article",
        "source_id": "fx-001",
        "field": "summary",
        "sentence": 2,
        "date": "2025-03-04",
        "url": "https://example.com/news/1",
    }


def test_other_source_kinds_use_the_same_passages():
    """보도자료 · 정책 문서도 source 모양으로만 바꾸면 같은 구절 · 원문 위치가 된다(-161)"""
    press = {
        "kind": "press_release",
        "source_id": "press:1",
        "field": "title",
        "text": "여수시, 청년 정착 지원 확대",
        "date": "2025-03-01",
        "url": None,
    }
    found = passages([*SOURCES, press])
    assert found[-1]["kind"] == "press_release"
    assert found[-1]["locator"]["source_id"] == "press:1"


def test_build_sends_only_undecided_rebuttals_and_fixed_judgment():
    sent = build(a3(), SOURCES, A3_CARD)
    assert [c["id"] for c in sent["rebuttal_candidates"]] == ["R1", "R2"]
    assert sent["fixed"]["claim_value"] == "decreasing"
    assert sent["question"]["period"] == "2023–2025"
    assert sent["passages"][0] == {
        "id": "P1",
        "kind": "article",
        "text": "[fixture] 여수 국가산단의 한 업체가 공장 가동을 줄였다.",
    }
    assert sent["forbidden_terms"].count("원인") == 1
    assert "배출원" in sent["forbidden_terms"]


SCHEMAS = [
    json.loads(p.read_text(encoding="utf-8"))
    for p in [*(CONTRACTS / "c2/schemas").glob("*.json"), *(CONTRACTS / "ai").glob("*.json")]
]
REGISTRY = Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in SCHEMAS)


def contract(name):
    schema = next(s for s in SCHEMAS if s["$id"].endswith(f"/ai/{name}.schema.json"))
    return Draft202012Validator(schema, registry=REGISTRY)


def test_a3_fixture_follows_judgment_input_contract():
    contract("judgment-input").validate(a3())


def test_card_rebuttal_ids_replace_order_numbers():
    judgment = c1()
    for n, candidate in enumerate(judgment["rebuttal_candidates"], 1):
        candidate["id"] = f"C1-R{n}"
    contract("judgment-input").validate(judgment)
    sent = build(judgment, SOURCES, C1_CARD)
    assert [c["id"] for c in sent["rebuttal_candidates"]] == ["C1-R1", "C1-R2", "C1-R3"]
    output = c1_output()
    for n, rebuttal in enumerate(output["rebuttals"], 1):
        rebuttal["id"] = f"C1-R{n}"
    result = phrase(judgment, SOURCES, C1_CARD, answer(output)[0])
    assert result.status == "done" and "C1-R3" in result.citations


# ── 검사기 ──


def test_valid_output_passes():
    assert problems(c1_output()) == set()


def test_rounded_input_number_passes_and_new_number_fails():
    output = {
        "claim_value": "decreasing",
        "warrant": {
            "text": "연평균이 18.6에서 16.9, 15.1로 낮아졌다.",
            "citations": ["ev_air_final_yeosu"],
        },
        "rebuttals": [
            {"id": "R1", "status": "not_found", "note": None, "citations": []},
            {"id": "R2", "status": "not_found", "note": None, "citations": []},
        ],
    }
    assert problems(output, a3(), A3_CARD) == set()
    output["warrant"]["text"] = "연평균이 3.5 낮아졌다."
    assert problems(output, a3(), A3_CARD) == {("number_mismatch", "warrant")}


def test_wrong_number_is_rejected():
    output = c1_output()
    output["warrant"]["text"] = output["warrant"]["text"].replace("2,240", "2,300")
    assert problems(output) == {("number_mismatch", "warrant")}


def test_number_must_come_from_the_cited_passage():
    output = c1_output()
    output["rebuttals"][2]["citations"] = [
        {"passage": "P3", "quote": "여수시가 청년 월세 지원 신청을"}
    ]
    assert problems(output) == {("number_mismatch", "R3")}


def test_fake_citations_are_rejected():
    output = c1_output()
    output["warrant"]["citations"] = ["ev_made_up"]
    output["rebuttals"][2]["note"] = None
    output["rebuttals"][2]["citations"] = [
        {"passage": "P9", "quote": "협력업체 직원 300여 명이 다른 지역으로 옮긴"},
        {"passage": "P1", "quote": "협력업체 직원 300여 명이 다른 지역으로 옮긴"},
    ]
    assert problems(output) == {
        ("unknown_citation", "warrant"),
        ("unknown_citation", "R3"),
        ("quote_not_in_source", "R3"),
        ("unsupported", "R3"),
    }


def test_too_short_quote_is_not_a_citation():
    output = c1_output()
    output["rebuttals"][2]["citations"] = [{"passage": "P2", "quote": "직원"}]
    assert ("quote_not_in_source", "R3") in problems(output)


def test_claims_without_evidence_are_rejected():
    output = c1_output()
    output["warrant"]["citations"] = []
    output["rebuttals"][0] = {"id": "R1", "status": "supported", "note": None, "citations": []}
    assert problems(output) == {("unsupported", "warrant"), ("unsupported", "R1")}


@pytest.mark.parametrize(
    "change",
    [
        lambda o: o.update(claim_value="decreasing"),
        lambda o: o["rebuttals"].pop(1),
        lambda o: o["rebuttals"].append(
            {"id": "R9", "status": "not_found", "note": None, "citations": []}
        ),
        lambda o: o["rebuttals"][1].update(id="R1"),
    ],
)
def test_changed_judgment_is_rejected(change):
    output = c1_output()
    change(output)
    assert {check for check, _ in problems(output)} == {"judgment_changed"}


@pytest.mark.parametrize("term", ["원인", "탈여수"])
def test_forbidden_terms_are_rejected(term):
    output = c1_output()
    output["rebuttals"][2]["note"] = f"산단 고용 변동이 {term}일 수 있다."
    assert problems(output) == {("forbidden_term", "R3")}


@pytest.mark.parametrize(
    "change",
    [
        lambda o: o.pop("warrant"),
        lambda o: o.update(qualifier="high"),
        lambda o: o["rebuttals"][0].update(status="maybe"),
        lambda o: o["warrant"].update(text=""),
    ],
)
def test_malformed_output_is_rejected(change):
    output = c1_output()
    change(output)
    assert {check for check, _ in problems(output)} == {"format"}


# ── 문장화 · 되돌리기 ──


def answer(output):
    calls = []

    def call(system, user):
        calls.append(json.loads(user))
        return json.dumps(output, ensure_ascii=False)

    return call, calls


def test_phrase_fills_warrant_and_rebuttals_with_llm_provenance():
    call, calls = answer(c1_output())
    result = phrase(c1(), SOURCES, C1_CARD, call)
    assert (result.status, result.reason_code, result.problems) == ("done", None, [])
    assert result.warrant == {"text": c1_output()["warrant"]["text"], "provenance": "llm_phrasing"}
    assert [r["provenance"] for r in result.rebuttals] == ["llm_judgment"] * 3
    assert result.rebuttals[2] == {
        "text": "산단·대형 사업장 고용 변동에 따른 일시 전입·전출 — "
        "산단 업체 가동 축소 뒤 협력업체 직원 300여 명이 옮겼다는 보도가 있다.",
        "status": "supported",
        "provenance": "llm_judgment",
    }
    assert result.citations["R3"][0]["locator"]["source_id"] == "fx-001"
    assert calls[0]["fixed"]["claim_value"] == "increasing"


def test_rule_decided_rebuttal_keeps_its_status_and_order():
    output = {
        "claim_value": "decreasing",
        "warrant": {"text": "같은 측정소의 연평균이 낮아졌다.", "citations": []},
        "rebuttals": [
            {"id": "R1", "status": "needs_review", "note": None, "citations": []},
            {"id": "R2", "status": "not_found", "note": None, "citations": []},
        ],
    }
    result = phrase(a3(), SOURCES, A3_CARD, answer(output)[0])
    assert [(r["status"], r["provenance"]) for r in result.rebuttals] == [
        ("needs_review", "llm_judgment"),
        ("not_found", "llm_judgment"),
        ("supported", "rule"),
    ]


@pytest.mark.parametrize(
    ("judgment", "reason"),
    [
        (example("judgment-insufficient"), "RUN_BLOCKED"),
        ({**c1(), "run_status": "unsupported"}, "RUN_UNSUPPORTED"),
        (example("judgment-not-comparable"), "NOT_JUDGED"),
    ],
)
def test_skipped_runs_do_not_call_the_model(judgment, reason):
    call, calls = answer(c1_output())
    result = phrase(judgment, SOURCES, C1_CARD, call)
    assert (result.status, result.reason_code, calls) == ("skipped", reason, [])
    assert result.warrant == judgment["warrant"] and result.rebuttals == []


def test_new_approved_card_needs_no_code_change():
    judgment = c1()
    judgment["question"]["card_id"] = "E1"
    card = {"card_id": "E1", "card_version": 1, "forbidden_terms": ["무상"]}
    call, calls = answer(c1_output())
    assert phrase(judgment, SOURCES, card, call).status == "done"
    assert "무상" in calls[0]["forbidden_terms"]


@pytest.mark.parametrize(
    "card", [{**C1_CARD, "card_version": 2}, {**C1_CARD, "card_id": "A3"}, {"forbidden_terms": []}]
)
def test_card_from_another_version_is_refused(card):
    call, calls = answer(c1_output())
    result = phrase(c1(), SOURCES, card, call)
    assert (result.status, result.reason_code, result.retryable, calls) == (
        "failed",
        "INPUT_INVALID",
        False,
        [],
    )
    assert result.warrant == c1()["warrant"] and result.rebuttals == []


def raises(error):
    def call(system, user):
        raise error

    return call


def rejected_answer():
    output = c1_output()
    output["warrant"]["text"] += " 2026년에는 -2,500명이 될 것이다."
    return answer(output)[0]


@pytest.mark.parametrize(
    ("call", "reason", "retryable"),
    [
        (raises(gms.LlmTimeout("시간 초과")), "LLM_TIMEOUT", True),
        (raises(gms.LlmError("HTTP 500")), "LLM_ERROR", True),
        (lambda system, user: "죄송합니다", "OUTPUT_REJECTED", False),
        (rejected_answer(), "OUTPUT_REJECTED", False),
    ],
)
def test_failures_fall_back_to_card_text_with_reason(call, reason, retryable):
    judgment = c1()
    result = phrase(judgment, SOURCES, C1_CARD, call)
    assert (result.status, result.reason_code, result.retryable) == ("failed", reason, retryable)
    assert result.warrant == {"text": judgment["warrant"]["text"], "provenance": "card"}
    assert result.rebuttals == [] and result.citations == {}
    assert (reason == "OUTPUT_REJECTED") == bool(result.problems)
    contract("phrasing-result").validate(result.result())


def test_every_result_follows_the_phrasing_result_contract():
    results = [
        phrase(c1(), SOURCES, C1_CARD, answer(c1_output())[0]),
        phrase(example("judgment-insufficient"), SOURCES, C1_CARD),
        phrase(c1(), SOURCES, {**C1_CARD, "card_version": 9}),
    ]
    assert [r.status for r in results] == ["done", "skipped", "failed"]
    for result in results:
        contract("phrasing-result").validate(result.result())


def test_cli_prints_the_result(tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(gms, "generate", answer(c1_output())[0])
    judgment, articles = tmp_path / "judgment.json", tmp_path / "articles.json"
    judgment.write_text(json.dumps({**c1(), "fixture": False}), encoding="utf-8")
    articles.write_text(json.dumps(ARTICLES), encoding="utf-8")
    assert main([str(judgment), str(articles)]) == 0
    contract("phrasing-result").validate(json.loads(capsys.readouterr().out))


def test_phrase_does_not_change_the_input():
    judgment = c1()
    before = copy.deepcopy(judgment)
    phrase(judgment, SOURCES, C1_CARD, answer(c1_output())[0])
    assert judgment == before


# ── GMS 호출 ──


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_generate_reads_text_and_maps_errors(monkeypatch):
    monkeypatch.setattr(gms, "api_key", lambda: "test-key")
    body = {"candidates": [{"content": {"parts": [{"text": '{"a": '}, {"text": "1}"}]}}]}
    monkeypatch.setattr(
        gms, "urlopen", lambda request, timeout: Response(json.dumps(body).encode())
    )
    assert gms.generate("system", "user") == '{"a": 1}'

    def fail(error):
        def urlopen(request, timeout):
            raise error

        return urlopen

    monkeypatch.setattr(gms, "urlopen", fail(TimeoutError()))
    with pytest.raises(gms.LlmTimeout):
        gms.generate("system", "user")
    monkeypatch.setattr(gms, "urlopen", fail(HTTPError("u", 400, "bad", {}, None)))
    with pytest.raises(gms.LlmError, match="HTTP 400"):
        gms.generate("system", "user")


# ── engine API (backend 가 부른다) ──


def request(judgment=None, card=C1_CARD):
    return copy.deepcopy({"judgment": judgment or c1(), "articles": ARTICLES, "card": card})


def test_api_phrases_a_valid_request(monkeypatch):
    call, calls = answer(c1_output())
    monkeypatch.setattr(gms, "generate", call)
    contract("phrasing-request").validate(request())
    response = TestClient(app).post("/v1/argument/phrase", json=request())
    assert response.status_code == 200
    contract("phrasing-result").validate(response.json())
    assert response.json()["warrant"]["provenance"] == "llm_phrasing"
    assert len(calls) == 1


def test_api_refuses_request_outside_the_contract_without_echoing_values(monkeypatch):
    call, calls = answer(c1_output())
    monkeypatch.setattr(gms, "generate", call)
    body = request()
    body["judgment"]["claim"]["value"] = "비밀 값"
    del body["card"]["card_version"]
    response = TestClient(app).post("/v1/argument/phrase", json=body)
    assert response.status_code == 422
    assert response.json()["reason_code"] == "INPUT_INVALID"
    assert "비밀 값" not in response.text
    assert calls == []


def test_api_skips_blocked_run_without_model(monkeypatch):
    call, calls = answer(c1_output())
    monkeypatch.setattr(gms, "generate", call)
    response = TestClient(app).post(
        "/v1/argument/phrase", json=request(example("judgment-insufficient"))
    )
    assert response.json()["reason_code"] == "RUN_BLOCKED" and calls == []


# ── 프롬프트 v3: 판정 이유는 규칙 결과 뜻으로, 보증에 연 값 ──


def card(name):
    return json.loads((CONTRACTS / "cards" / f"{name}.json").read_text(encoding="utf-8"))


def test_rule_meaning_is_the_outcome_the_rule_chose():
    judgment = c1()
    judgment["claim"]["text"] = "여수시에서 2023–2025 청년(19–39세) 순이동이 청년 순유출 확대."
    fixed = build(judgment, SOURCES, card("C1"))["fixed"]
    assert fixed["rule_meaning"].startswith("모든 해가 음수이고 절대값이 해마다 커짐")
    assert {o["label"] for o in fixed["rule_outcomes"]} >= {"청년 순유출 확대", "불분명"}
    # 승인본에 규칙이 없거나 판단 문장에 결과 이름이 없으면 뜻을 붙이지 않는다
    assert build(c1(), SOURCES, C1_CARD)["fixed"]["rule_meaning"] is None


def test_statistics_say_whether_a_value_is_the_place_or_a_station():
    judgment = a3()
    judgment["statistics_points"].append(
        {**judgment["statistics_points"][0], "place_id": "kr-12130", "value": 17.25}
    )
    places = [s["place"] for s in build(judgment, SOURCES, card("A3"))["statistics"]]
    assert places == ["kr-12130-s336127"] * 3 + ["여수시"]


def test_numbers_in_the_rule_meaning_may_be_used():
    judgment = a3()
    output = {
        "claim_value": "decreasing",
        "warrant": {
            "text": "여수시 측정소의 PM2.5 연평균은 2023년 18.6에서 2025년 15.1이 되어 "
            "끝해 − 첫해가 −3µg/m³ 이하라 개선으로 판정했다.",
            "citations": ["ev_air_final_yeosu"],
        },
        "rebuttals": [
            {"id": "R1", "status": "not_found", "note": None, "citations": []},
            {"id": "R2", "status": "not_found", "note": None, "citations": []},
        ],
    }
    assert problems(output, judgment, card("A3")) == set()
