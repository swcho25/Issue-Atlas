"""③ 보증 · ⑤ 반박 문장화. 판정 · 수치는 바꾸지 않는다.

부르지 않거나 실패하면 카드 보증 문구 · 빈 반박으로 돌아간다.

| status | reason_code | 언제 |
| skipped | RUN_BLOCKED · RUN_UNSUPPORTED | 실행이 blocked · unsupported |
| skipped | NOT_JUDGED | 판단이 insufficient · not_comparable |
| failed | INPUT_INVALID | 카드 승인본이 그 실행의 카드 · 판이 아님 |
| failed | LLM_TIMEOUT · LLM_ERROR | 모델 호출 실패. 다시 돌릴 수 있다 |
| failed | OUTPUT_REJECTED | JSON 아님 · 검사 탈락(problems). 다시 돌리지 않고 검수로 |
"""

import json
from collections.abc import Callable
from dataclasses import asdict, dataclass, field

from . import gms
from .check import Problem, check
from .prompt import PROMPT_VERSION, SYSTEM, build, passages, rebuttal_ids

# contracts/ai phrasing-result.schema.json
RESULT_VERSION = "ai-phrasing-result-0.2"


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

    def result(self) -> dict:
        """contracts/ai 문장화 결과 모양"""
        return {"schema_version": RESULT_VERSION, **asdict(self), "retryable": self.retryable}


def skip_reason(judgment: dict) -> str | None:
    """승인본으로 판정을 끝낸 실행만 부른다.

    카드 목록은 두지 않는다. 승인본 없는 카드는 실행이 unsupported 라 여기서 걸린다.
    """
    if judgment["run_status"] in ("blocked", "unsupported"):
        return f"RUN_{judgment['run_status'].upper()}"
    if judgment["claim"]["value"] in ("insufficient", "not_comparable"):
        return "NOT_JUDGED"
    return None


def phrase(
    judgment: dict,
    sources: list[dict],
    card: dict,
    call: Callable[[str, str], str] | None = None,
) -> Phrasing:
    """judgment = contracts/ai judgment-input, sources = 근거 자료(prompt 「source」 모양),
    card = 그 실행이 쓴 카드 승인본(DB card_version.spec). call 이 없으면 GMS 를 부른다
    """
    run_id, model, call = judgment["run_id"], gms.MODEL, call or gms.generate
    fallback = dict(judgment["warrant"])
    reason = skip_reason(judgment)
    if reason:
        return Phrasing(run_id, "skipped", reason, fallback, [])
    # 승인본 판이 판정과 다르면 금지어 · 경쟁 설명이 다른 판의 것이 된다
    if (card.get("card_id"), card.get("card_version")) != (
        judgment["question"]["card_id"],
        judgment["card_version"],
    ):
        return Phrasing(run_id, "failed", "INPUT_INVALID", fallback, [])
    sent = build(judgment, sources, card)
    try:
        raw = call(SYSTEM, json.dumps(sent, ensure_ascii=False))
    except gms.LlmTimeout:
        return Phrasing(run_id, "failed", "LLM_TIMEOUT", fallback, [], model=model)
    except gms.LlmError:
        return Phrasing(run_id, "failed", "LLM_ERROR", fallback, [], model=model)
    try:
        output = json.loads(raw)
    except ValueError:
        output = None
    problems = check(sent, output)
    if problems:
        return Phrasing(run_id, "failed", "OUTPUT_REJECTED", fallback, [], {}, problems, model)

    by_id = {r["id"]: r for r in output["rebuttals"]}
    locators = {p["id"]: p["locator"] for p in passages(sources)}
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
