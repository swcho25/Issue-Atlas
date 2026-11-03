"""모델에 보낼 입력 판. 판정 입력(contracts/ai judgment-input) + 근거 자료 구절 → 문장화 입력.

근거 자료는 종류와 상관없이 같은 모양(source)으로 받는다:
{kind, source_id, field, text, date, url}.
종류마다 이 모양으로 바꾸는 함수만 둔다(예: article_sources).
검사기도 이 입력만 보고 인용 · 수치를 맞춘다.
원문 위치(locator)는 모델에 보내지 않고 결과에만 붙인다.
"""

import re
from datetime import date, timedelta

PROMPT_VERSION = "argument-phrasing-v2"
MAX_SOURCES = 40
STATUSES = ("supported", "not_found", "needs_review")
# C2 「공통 규칙」: 문구에 쓰지 않는다. 카드 금지어와 합친다
COMMON_FORBIDDEN = ("확산", "전파", "원인", "효과")

SYSTEM = "\n".join(
    [
        "너는 논증 카드의 ③ 보증과 ⑤ 반박 칸을 쓰는 도우미다. 판정은 규칙 엔진이 이미 끝냈다.",
        "지킬 것:",
        "1. fixed 의 값(판단 값 · 수준 · 문장 · 한정어 · 비교 조건)은 바꾸지 않는다."
        " 출력 claim_value 에는 fixed.claim_value 를 그대로 적는다.",
        "2. 숫자는 statistics 의 value · period 와 입력 문장에 이미 있는 숫자만 쓴다."
        " 더하기 · 빼기 · 비율 같은 새 계산을 하지 않는다.",
        "3. warrant.text: card_warrant 의 논리를 이 질문(지역 · 기간)에 맞게 두 문장 이내로"
        " 다시 쓴다. fixed 판단과 반대되는 말을 하지 않는다."
        " statistics 값을 쓰면 그 evidence_id 를 warrant.citations 에 넣는다.",
        "4. rebuttals: rebuttal_candidates 마다 같은 id 로 하나씩."
        " passages 에 그 경쟁 설명을 뒷받침하는 내용이 있으면 status 를 supported 로 하고"
        " citations 에 passage id 와, 그 구절에서 글자 그대로 옮긴 quote 를 넣는다."
        " 관련 구절이 없으면 not_found, 애매하면 needs_review. note 는 한 문장 또는 null.",
        "5. ceiling 에 있는 것은 말하지 않는다. forbidden_terms 의 낱말은 쓰지 않는다.",
        '6. 출력은 JSON 하나: {"claim_value": "...",'
        ' "warrant": {"text": "...", "citations": ["evidence_id"]},'
        ' "rebuttals": [{"id": "R1", "status": "...", "note": null,'
        ' "citations": [{"passage": "P1", "quote": "..."}]}]}',
    ]
)


def article_sources(articles: list[dict]) -> list[dict]:
    """C2 articles[] → source. 기사는 요약만 쓴다(본문은 요약 뒤 지움)"""
    return [
        {
            "kind": "article",
            "source_id": a["id"],
            "field": "summary",
            "text": a.get("summary") or "",
            "date": a["date"],
            "url": a.get("url"),
        }
        for a in articles
    ]


def passages(sources: list[dict]) -> list[dict]:
    """자료 글을 문장 하나씩 구절로 나눈다.

    원문 위치 = 자료 종류 · 원천 ID · 칸 · 몇 번째 문장 · 날짜 · 링크
    """
    found = []
    for source in sources[:MAX_SOURCES]:
        sentences = re.split(r"(?<=[.!?])\s+", source["text"].strip())
        for n, sentence in enumerate((s for s in sentences if s), 1):
            locator = {k: source[k] for k in ("kind", "source_id", "field", "date", "url")}
            found.append(
                {
                    "id": f"P{len(found) + 1}",
                    "kind": source["kind"],
                    "text": sentence,
                    "locator": {**locator, "sentence": n},
                }
            )
    return found


def rebuttal_ids(candidates: list[dict]) -> list[str | None]:
    """규칙이 정하지 않은 경쟁 설명에만 R1, R2 … 를 준다.

    규칙이 정한 것은 None 이고 모델에 보내지 않는다.
    """
    ids, n = [], 0
    for candidate in candidates:
        if candidate["decided_by_rule"] is None:
            n += 1
            ids.append(f"R{n}")
        else:
            ids.append(None)
    return ids


def period(start: str, end: str) -> str:
    """[start, end) 를 끝을 빼고 적는다. backend QuestionService.period 와 같은 모양"""
    first, last = date.fromisoformat(start), date.fromisoformat(end) - timedelta(days=1)
    if (first.month, first.day, last.month, last.day) == (1, 1, 12, 31):
        return f"{first.year}년" if first.year == last.year else f"{first.year}–{last.year}"
    return f"{first}~{last}"


def build(judgment: dict, sources: list[dict], card: dict) -> dict:
    """card = 그 실행이 쓴 카드 승인본(DB card_version.spec).

    카드마다 다른 설정은 여기서만 읽는다.
    """
    question = judgment["question"]
    candidates = judgment["rebuttal_candidates"]
    return {
        "question": {
            "place": question["place_name"],
            "card": question["card_name"],
            "period": period(question["period_start"], question["period_end"]),
        },
        "fixed": {
            "claim_value": judgment["claim"]["value"],
            "claim_level": judgment["claim"]["level"],
            "claim_text": judgment["claim"]["text"],
            "qualifier_grade": judgment["qualifier"]["grade"],
            "comparability": {k: v["note"] for k, v in judgment["comparability"].items()},
        },
        "card_warrant": judgment["warrant"]["text"],
        "statistics": [
            {
                "evidence_id": p["evidence_id"],
                "indicator_id": p["indicator_id"],
                "place_id": p["place_id"],
                "period": period(p["period_start"], p["period_end"]),
                "value": p["value"],
                "unit": p["unit"],
                "missing_reason": p["missing_reason"],
            }
            for p in judgment["statistics_points"]
        ],
        "evidence": [
            {
                "evidence_id": ref["evidence_id"],
                "kind": kind,
                "title": ref["title"],
                "source_name": ref["source_name"],
            }
            for kind, refs in judgment["data"].items()
            if kind != "provenance"
            for ref in refs
        ],
        "rebuttal_candidates": [
            {"id": rid, "text": c["text"]}
            for rid, c in zip(rebuttal_ids(candidates), candidates, strict=True)
            if rid
        ],
        "passages": [
            {"id": p["id"], "kind": p["kind"], "text": p["text"]} for p in passages(sources)
        ],
        "ceiling": judgment["ceiling"]["items"],
        "forbidden_terms": list(
            dict.fromkeys([*COMMON_FORBIDDEN, *card.get("forbidden_terms", [])])
        ),
    }
