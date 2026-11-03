"""③ 보증 · ⑤ 반박 문장화. 판정 · 수치는 바꾸지 않는다.

부르지 않거나 실패하면 카드 보증 문구 · 빈 반박으로 돌아간다.

| status | reason_code | 언제 |
| skipped | RUN_BLOCKED · RUN_UNSUPPORTED | 실행이 blocked · unsupported |
| skipped | NOT_JUDGED | 판단이 insufficient · not_comparable |
| skipped | CARD_NOT_SUPPORTED | C1 · A3 가 아닌 카드 (첫 판 범위) |
| failed | LLM_TIMEOUT · LLM_ERROR | 모델 호출 실패. 다시 돌릴 수 있다 |
| failed | OUTPUT_REJECTED | JSON 아님 · 검사 탈락(problems). 다시 돌리지 않고 검수로 |
"""

import json
from collections.abc import Callable
from dataclasses import dataclass, field

from . import gms
from .check import Problem, check
from .prompt import PROMPT_VERSION, SYSTEM, build, passages, rebuttal_ids

SUPPORTED_CARDS = ("C1", "A3")


@dataclass(frozen=True)
class Phrasing:
    """warrant · rebuttals 는 C2 칸 모양 그대로.

    citations 는 C2 로 나가지 않는 감사용이다(칸 → 인용 · 원문 위치).
    """

    run_id: str
    status: str
    reason_code: str | None
    warrant: dict
    rebuttals: list[dict]
    citations: dict = field(default_factory=dict)
    problems: list[Problem] = field(default_factory=list)
    model: str | None = None
    prompt_version: str = PROMPT_VERSION

    @property
    def retryable(self) -> bool:
        return self.reason_code in ("LLM_TIMEOUT", "LLM_ERROR")


def skip_reason(judgment: dict) -> str | None:
    if judgment["run_status"] in ("blocked", "unsupported"):
        return f"RUN_{judgment['run_status'].upper()}"
    if judgment["claim"]["value"] in ("insufficient", "not_comparable"):
        return "NOT_JUDGED"
    if judgment["question"]["card_id"] not in SUPPORTED_CARDS:
        return "CARD_NOT_SUPPORTED"
    return None


def phrase(
    judgment: dict,
    articles: list[dict],
    forbidden_terms: list[str],
    call: Callable[[str, str], str] = gms.generate,
) -> Phrasing:
    """judgment = contracts/ai judgment-input, articles = C2 articles[] (요약 · 날짜 · 링크)"""
    run_id, model = judgment["run_id"], gms.MODEL
    card = dict(judgment["warrant"])
    reason = skip_reason(judgment)
    if reason:
        return Phrasing(run_id, "skipped", reason, card, [])
    sent = build(judgment, articles, forbidden_terms)
    try:
        raw = call(SYSTEM, json.dumps(sent, ensure_ascii=False))
    except gms.LlmTimeout:
        return Phrasing(run_id, "failed", "LLM_TIMEOUT", card, [], model=model)
    except gms.LlmError:
        return Phrasing(run_id, "failed", "LLM_ERROR", card, [], model=model)
    try:
        output = json.loads(raw)
    except ValueError:
        output = None
    problems = check(sent, output)
    if problems:
        return Phrasing(run_id, "failed", "OUTPUT_REJECTED", card, [], {}, problems, model)

    by_id = {r["id"]: r for r in output["rebuttals"]}
    locators = {p["id"]: p["locator"] for p in passages(articles)}
    rebuttals = []
    citations = {"warrant": output["warrant"]["citations"]}
    candidates = judgment["rebuttal_candidates"]
    for rid, candidate in zip(rebuttal_ids(candidates), candidates, strict=True):
        if rid is None:
            status = candidate["decided_by_rule"]
            rebuttals.append({"text": candidate["text"], "status": status, "provenance": "rule"})
            continue
        answer = by_id[rid]
        note = answer["note"]
        rebuttals.append(
            {
                "text": f"{candidate['text']} — {note}" if note else candidate["text"],
                "status": answer["status"],
                "provenance": "llm_judgment",
            }
        )
        citations[rid] = [{**c, "locator": locators[c["passage"]]} for c in answer["citations"]]
    warrant = {"text": output["warrant"]["text"], "provenance": "llm_phrasing"}
    return Phrasing(run_id, "done", None, warrant, rebuttals, citations, model=model)
