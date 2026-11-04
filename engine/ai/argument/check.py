"""모델 출력 검사. 네트워크 없이 문장화 입력(prompt.build)과 출력만 본다.

떨어진 곳마다 Problem 하나. 검사 이름
- format: 모양 · judgment_changed: 판단 값 · 경쟁 설명 목록이 입력과 다름
- unknown_citation: 입력에 없는 ID · quote_not_in_source: 구절에 글자 그대로 없음
- number_mismatch: 입력에 없는 숫자 · unsupported: 근거 부족 · forbidden_term: 금지어
"""

import re
from dataclasses import dataclass
from decimal import Decimal

from jsonschema import Draft202012Validator

from .prompt import STATUSES

# 따옴표 안 구절이 이보다 짧으면 인용으로 보지 않는다(「직원」 같은 낱말 하나는 어디에나 있다)
MIN_QUOTE = 8
NUMBER = re.compile(r"[0-9][0-9,]*(?:\.[0-9]+)?")

OUTPUT = Draft202012Validator(
    {
        "type": "object",
        "properties": {
            "claim_value": {"type": "string"},
            "warrant": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "minLength": 1, "maxLength": 400},
                    "citations": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "citations"],
                "additionalProperties": False,
            },
            "rebuttals": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "status": {"enum": list(STATUSES)},
                        "note": {"type": ["string", "null"], "maxLength": 200},
                        "citations": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "passage": {"type": "string"},
                                    "quote": {"type": "string"},
                                },
                                "required": ["passage", "quote"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["id", "status", "note", "citations"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["claim_value", "warrant", "rebuttals"],
        "additionalProperties": False,
    }
)


@dataclass(frozen=True)
class Problem:
    check: str
    where: str
    detail: str


def numbers(text: str) -> list[str]:
    return [m.replace(",", "") for m in NUMBER.findall(text or "")]


def known(token: str, allowed: set[Decimal]) -> bool:
    """입력 값과 같거나, 입력 값을 그 자릿수로 반올림한 값이면 통과.

    부호는 보지 않는다(「순유출 1,850명」= -1850).
    """
    value = Decimal(token)
    step = Decimal(1).scaleb(value.as_tuple().exponent)
    return any(abs(a).quantize(step) == value for a in allowed)


def base_numbers(sent: dict) -> set[Decimal]:
    """모델이 어느 칸에나 쓸 수 있는 숫자: 통계 값과 입력 문장 속 숫자.

    ID 와 기사 구절 숫자는 빼고 센다(구절 숫자는 그 구절을 인용한 칸에서만 쓴다).
    """
    fixed = sent["fixed"]
    texts = [
        *sent["question"].values(),
        fixed["claim_text"],
        *fixed["comparability"].values(),
        fixed.get("rule_meaning"),
        *(f"{o['label']} {o['meaning']}" for o in fixed.get("rule_outcomes", [])),
        sent["card_warrant"],
        *(s["period"] for s in sent["statistics"]),
        *(e["title"] for e in sent["evidence"]),
        *(c["text"] for c in sent["rebuttal_candidates"]),
        *sent["ceiling"],
    ]
    found = {Decimal(n) for text in texts if text for n in numbers(text)}
    return found | {Decimal(str(s["value"])) for s in sent["statistics"] if s["value"] is not None}


def same(text: str) -> str:
    return " ".join(text.split())


def check(sent: dict, output) -> list[Problem]:
    shape = [
        Problem("format", "/".join(map(str, e.absolute_path)) or "output", e.message)
        for e in OUTPUT.iter_errors(output)
    ]
    if shape:
        return shape
    problems = []
    if output["claim_value"] != sent["fixed"]["claim_value"]:
        problems.append(Problem("judgment_changed", "claim", output["claim_value"]))
    expected = sorted(c["id"] for c in sent["rebuttal_candidates"])
    if sorted(r["id"] for r in output["rebuttals"]) != expected:
        problems.append(Problem("judgment_changed", "rebuttals", "경쟁 설명 목록이 다릅니다"))

    base = base_numbers(sent)
    evidence = {s["evidence_id"] for s in sent["statistics"]} | {
        e["evidence_id"] for e in sent["evidence"]
    }
    source = {p["id"]: p["text"] for p in sent["passages"]}
    terms = sent["forbidden_terms"]

    def wording(where: str, text: str, allowed: set[Decimal]):
        problems.extend(
            Problem("number_mismatch", where, n) for n in numbers(text) if not known(n, allowed)
        )
        problems.extend(Problem("forbidden_term", where, t) for t in terms if t in (text or ""))

    warrant = output["warrant"]
    problems.extend(
        Problem("unknown_citation", "warrant", c) for c in warrant["citations"] if c not in evidence
    )
    if numbers(warrant["text"]) and not warrant["citations"]:
        problems.append(Problem("unsupported", "warrant", "숫자를 썼지만 인용한 근거가 없습니다"))
    wording("warrant", warrant["text"], base)

    for rebuttal in output["rebuttals"]:
        where, cited = rebuttal["id"], []
        for citation in rebuttal["citations"]:
            text, quote = source.get(citation["passage"]), same(citation["quote"])
            if text is None:
                problems.append(Problem("unknown_citation", where, citation["passage"]))
            elif len(quote) < MIN_QUOTE or quote not in same(text):
                problems.append(Problem("quote_not_in_source", where, citation["passage"]))
            else:
                cited.append(text)
        if rebuttal["status"] == "supported" and not cited:
            problems.append(Problem("unsupported", where, "근거 구절 없이 supported 입니다"))
        passage_numbers = {Decimal(n) for text in cited for n in numbers(text)}
        wording(where, rebuttal["note"], base | passage_numbers)
    return problems
