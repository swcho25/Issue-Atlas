"""모델에 보낼 입력 판. 판정 입력(contracts/ai judgment-input) + 근거 자료 구절 → 문장화 입력.

근거 자료는 종류와 상관없이 같은 모양(source)으로 받는다:
{kind, source_id, field, text, date, url}.
종류마다 이 모양으로 바꾸는 함수만 둔다(예: article_sources).
검사기도 이 입력만 보고 인용 · 수치를 맞춘다.
원문 위치(locator)는 모델에 보내지 않고 결과에만 붙인다.
"""

import re
from datetime import date, timedelta
from decimal import Decimal

PROMPT_VERSION = "argument-phrasing-v5"
MAX_SOURCES = 40
STATUSES = ("supported", "not_found", "needs_review")
# C2 「공통 규칙」: 문구에 쓰지 않는다. 카드 금지어와 합친다
COMMON_FORBIDDEN = ("확산", "전파", "원인", "효과")

# v4(S15P31C108-282): ① 판단 문장(연 값)은 규칙, ③ 보증은 카드 문장이라
# 모델은 ⑤ 반박만 쓴다(Figma: AI 칩은 ⑤ 만)
# v5(S15P31C108-286): 카드 sign_words 가 있는 통계 값은 부호 대신 낱말 글자(value_text)를 함께 보내
# 반박 note 가 「순유출 1,537명」처럼 쓰게 한다
SYSTEM = "\n".join(
    [
        "너는 논증 카드의 ⑤ 반박 칸을 쓰는 도우미다."
        " 판정과 다른 칸은 규칙 엔진과 카드가 이미 끝냈다.",
        "지킬 것:",
        "1. fixed 의 값(판단 값 · 수준 · 문장 · 한정어 · 비교 조건)은 바꾸지 않는다."
        " 출력 claim_value 에는 fixed.claim_value 를 그대로 적는다.",
        "2. 숫자는 statistics 의 value · period, 입력 문장, 인용한 구절에 이미 있는 숫자만 쓴다."
        " 더하기 · 빼기 · 비율 같은 새 계산을 하지 않는다.",
        "2-1. statistics 에 value_text 가 있는 값을 쓸 때는 value_text 글자 그대로 쓴다"
        "(부호 대신 sign_words 의 낱말. 예: 순유출 1,537명). 숫자 앞에 - 를 붙이지 않고,"
        " 낱말 없이 숫자만 쓰지 않는다."
        " value_text 가 없는 값은 부호와 같은 뜻의 낱말을 겹쳐 쓰지 않는다"
        "(순유출 -1,850명 ✗ → 순이동 -1,850명 또는 순유출 1,850명).",
        "3. rebuttals: rebuttal_candidates 마다 같은 id 로 하나씩."
        " passages 에 그 경쟁 설명을 뒷받침하는 내용이 있으면 status 를 supported 로 하고"
        " citations 에 passage id 와, 그 구절에서 글자 그대로 옮긴 quote 를 넣는다."
        " 관련 구절이 없으면 not_found, 애매하면 needs_review. note 는 한 문장 또는 null.",
        "4. ceiling 에 있는 것은 말하지 않는다. forbidden_terms 의 낱말은 쓰지 않는다.",
        '5. 출력은 JSON 하나: {"claim_value": "...",'
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
    """규칙이 정하지 않은 경쟁 설명에만 ID 를 준다.

    카드 반박 ID(C1-R1)가 있으면 그것, 없으면 R1, R2 ….
    규칙이 정한 것은 None 이고 모델에 보내지 않는다.
    """
    ids, n = [], 0
    for candidate in candidates:
        if candidate["decided_by_rule"] is None:
            n += 1
            ids.append(candidate.get("id") or f"R{n}")
        else:
            ids.append(None)
    return ids


def period(start: str, end: str) -> str:
    """[start, end) 를 끝을 빼고 적는다. backend QuestionService.period 와 같은 모양"""
    first, last = date.fromisoformat(start), date.fromisoformat(end) - timedelta(days=1)
    if (first.month, first.day, last.month, last.day) == (1, 1, 12, 31):
        return f"{first.year}년" if first.year == last.year else f"{first.year}–{last.year}"
    return f"{first}~{last}"


def sign_words(card: dict) -> dict[str, dict]:
    """카드 claim_items 의 sign_words(지표 → {negative, positive}). 카드 계약 v0.6"""
    return {
        item["indicator_id"]: item["sign_words"]
        for item in card.get("claim_items", [])
        if item.get("sign_words")
    }


def value_text(value, unit: str | None, words: dict | None) -> str | None:
    """sign_words 가 있는 값을 부호 대신 낱말로: -1537 → 「순유출 1,537명」, 0 → 「0명」.

    값이 없거나 낱말이 없으면 None(그 값은 지금처럼 value 로만 보낸다)
    """
    if value is None or not words:
        return None
    number = Decimal(str(value))
    if number == number.to_integral_value():
        number = number.quantize(Decimal(1))
    shown = f"{abs(number):,}{unit or ''}"
    if number == 0:
        return shown
    return f"{words['negative'] if number < 0 else words['positive']} {shown}"


def statistic(point: dict, question: dict, words: dict | None) -> dict:
    entry = {
        "evidence_id": point["evidence_id"],
        "indicator_id": point["indicator_id"],
        # 질문 지역 값인지(측정소가 여럿이면 지역 값 = 공통 측정소 평균) 측정소 값인지
        "place": question["place_name"]
        if point["place_id"] == question["place_id"]
        else point["place_id"],
        "period": period(point["period_start"], point["period_end"]),
        "value": point["value"],
        "unit": point["unit"],
        "missing_reason": point["missing_reason"],
    }
    text = value_text(point["value"], point["unit"], words)
    if text is not None:
        entry["value_text"] = text
    return entry


def build(judgment: dict, sources: list[dict], card: dict) -> dict:
    """card = 그 실행이 쓴 카드 승인본(DB card_version.spec).

    카드마다 다른 설정(금지어 · 부호 낱말)은 여기서만 읽는다.
    보증을 쓰지 않으므로(v4) 카드 보증 · 규칙 결과 뜻은 보내지 않는다.
    부호 낱말이 없는 카드는 v4 와 같은 입력이다(value_text · sign_words 칸이 없다).
    """
    question = judgment["question"]
    candidates = judgment["rebuttal_candidates"]
    words = sign_words(card)
    sent = {
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
        "statistics": [
            statistic(p, question, words.get(p["indicator_id"]))
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
    used = {s["indicator_id"] for s in sent["statistics"] if "value_text" in s}
    if used:
        sent["sign_words"] = {k: words[k] for k in sorted(used)}
    return sent
