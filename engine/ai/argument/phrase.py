"""⑤ 반박 문장화. 판정 · 수치 · 다른 칸은 바꾸지 않는다.

① 판단은 규칙 문장(연 값), ③ 보증은 카드 문장이라 모델은 반박만 쓴다(v0.3, S15P31C108-282).
부르지 않거나 실패하면 빈 반박으로 돌아간다.

| status | reason_code | 언제 |
| skipped | RUN_BLOCKED · RUN_UNSUPPORTED | 실행이 blocked · unsupported |
| skipped | NOT_JUDGED | 판단이 insufficient · not_comparable |
| failed | INPUT_INVALID | 카드 승인본이 그 실행의 카드 · 판이 아님 |
| failed | LLM_TIMEOUT · LLM_ERROR | 모델 호출 실패. 다시 돌릴 수 있다 |
| failed | OUTPUT_REJECTED | JSON 아님 · 모양 · 판단 값 · 경쟁 설명 목록이 어긋남(problems) |
| done | — | 반박 하나만 검사 탈락 → 그 반박만 needs_review, problems 에 남김(v0.4) |

근거 구절(v0.5, S15P31C108-326): 요청에 `rebuttal_search` 가 있으면 반박마다 고른 기사
(retrieve.py), 없으면 요청 `articles`(카드 꼬리표 기사). 어느 쪽을 썼고 무엇을 왜 골랐는지는
결과 `retrieval` 에 남긴다.
"""

import json
from collections.abc import Callable
from dataclasses import asdict, dataclass, field

from . import gms, retrieve
from .check import Problem, check
from .prompt import PROMPT_VERSION, SYSTEM, article_sources, build, passages, rebuttal_ids

# contracts/ai phrasing-result.schema.json
RESULT_VERSION = "ai-phrasing-result-0.5"
# 반박 하나의 검사에서 떨어지면 그 반박만 낮출 상태
DOWNGRADED = "needs_review"


@dataclass(frozen=True)
class Phrasing:
    """rebuttals 는 C2 칸 모양 그대로.

    citations 는 C2 로 나가지 않는 감사용이다(반박 ID → 인용 · 원문 위치).
    retrieval 은 근거 구절을 어떻게 골랐는지(retrieve.py).
    건너뛰거나 입력이 틀려 고르지 않았으면 None.
    """

    run_id: str
    status: str
    reason_code: str | None
    rebuttals: list[dict]
    citations: dict = field(default_factory=dict)
    problems: list[Problem] = field(default_factory=list)
    model: str | None = None
    prompt_version: str = PROMPT_VERSION
    retrieval: dict | None = None

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
    search: dict | None = None,
) -> Phrasing:
    """judgment = contracts/ai judgment-input, sources = 근거 자료(prompt 「source」 모양),
    card = 그 실행이 쓴 카드 승인본(DB card_version.spec). call 이 없으면 GMS 를 부른다.
    search = 요청 rebuttal_search. 물을 반박의 질의가 있으면 sources 대신 반박마다 고른 기사를 쓴다
    """
    run_id, model, call = judgment["run_id"], gms.MODEL, call or gms.generate
    reason = skip_reason(judgment)
    if reason:
        return Phrasing(run_id, "skipped", reason, [])
    # 승인본 판이 판정과 다르면 금지어 · 경쟁 설명이 다른 판의 것이 된다
    if (card.get("card_id"), card.get("card_version")) != (
        judgment["question"]["card_id"],
        judgment["card_version"],
    ):
        return Phrasing(run_id, "failed", "INPUT_INVALID", [])
    candidates = judgment["rebuttal_candidates"]
    asked = [rid for rid in rebuttal_ids(candidates) if rid]
    if retrieve.asks(search, asked):
        try:
            picked, retrieval = retrieve.select(search, asked)
        except ValueError:
            return Phrasing(run_id, "failed", "INPUT_INVALID", [])
        sources = article_sources(picked)
    else:
        retrieval = retrieve.card_tags(len(sources))
    sent = build(judgment, sources, card)
    try:
        raw = call(SYSTEM, json.dumps(sent, ensure_ascii=False))
    except gms.LlmTimeout:
        return Phrasing(run_id, "failed", "LLM_TIMEOUT", [], model=model, retrieval=retrieval)
    except gms.LlmError:
        return Phrasing(run_id, "failed", "LLM_ERROR", [], model=model, retrieval=retrieval)
    try:
        output = json.loads(raw)
    except ValueError:
        output = None
    problems = check(sent, output)
    # where 가 반박 ID 가 아닌 탈락(모양 · 판단 값 · 경쟁 설명 목록)은 출력 전체를 믿을 수 없다
    asked = {c["id"] for c in sent["rebuttal_candidates"]}
    if any(p.where not in asked for p in problems):
        return Phrasing(
            run_id, "failed", "OUTPUT_REJECTED", [], {}, problems, model, retrieval=retrieval
        )
    downgraded = {p.where for p in problems}

    by_id = {r["id"]: r for r in output["rebuttals"]}
    locators = {p["id"]: p["locator"] for p in passages(sources)}
    rebuttals, citations = [], {}
    for rid, candidate in zip(rebuttal_ids(candidates), candidates, strict=True):
        if rid is None:
            status = candidate["decided_by_rule"]
            rebuttals.append({"text": candidate["text"], "status": status, "provenance": "rule"})
            continue
        if rid in downgraded:
            # 인용 · 숫자 · 낱말 중 하나라도 어긋난 반박은 모델 답을 쓰지 않고 검토로 남긴다
            rebuttals.append(
                {"text": candidate["text"], "status": DOWNGRADED, "provenance": "llm_judgment"}
            )
            citations[rid] = []
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
    return Phrasing(
        run_id, "done", None, rebuttals, citations, problems, model, retrieval=retrieval
    )
