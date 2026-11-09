"""네트워크·DB와 독립적인 분류 입력 판."""

import hashlib
import json
from dataclasses import dataclass

INPUT_VERSION = "news-title-summary-v1"
PROFILE_VERSION = "card-profile-v1"
MODEL = "gemini-embedding-2"
DIMENSIONS = 1536


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class DocumentInput:
    input_id: str
    doc_id: str
    news_id: str
    raw_content_hash: str
    input_text: str
    input_hash: str


def document_input(news_id: str, title: str, summary: str, raw_content_hash: str) -> DocumentInput:
    text = f"제목: {title.strip()}\n요약: {summary.strip()}"
    input_hash = digest(text)
    identity = json.dumps(
        [news_id, raw_content_hash, INPUT_VERSION, input_hash],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return DocumentInput(
        f"dsi:{digest(identity)}", f"news:{news_id}", news_id, raw_content_hash, text, input_hash
    )


def card_profile(spec: dict) -> str:
    """승인본의 포함 범위만 사용한다. exclusion은 유사도를 거꾸로 높이므로 제외한다."""
    lines = [
        f"이슈: {spec['name']}",
        f"질문: {spec['parent_question']}",
        f"포함: {' / '.join(spec['inclusion'])}",
        f"키워드: {', '.join(spec['keywords'])}",
    ]
    return "\n".join(lines)


def select(score: float, threshold: float) -> bool:
    return score >= threshold


# thresholds.json 의 카드별 방식. cosine = 카드 프로필 코사인, f4 = 학습 분류기 확률(f4.py)
METHODS = ("cosine", "f4")
CARD_IDS = {"C1", "A3"}
# 방식별 기준값 범위: 코사인은 -1~1, 확률은 0~1
THRESHOLD_RANGE = {"cosine": (-1, 1), "f4": (0, 1)}


@dataclass(frozen=True)
class CardRule:
    method: str
    threshold: float


def card_rules(config: dict) -> dict[str, CardRule]:
    """thresholds.json → 카드별 방식·기준값. C1·A3 둘 다, 아는 방식, 방식별 범위의 숫자만 받는다."""
    cards = config.get("cards")
    if not isinstance(cards, dict) or set(cards) != CARD_IDS:
        raise ValueError("C1·A3 카드 설정이 모두 필요합니다")
    rules = {}
    for card_id, rule in cards.items():
        if not isinstance(rule, dict) or rule.get("method") not in METHODS:
            raise ValueError(f"{card_id}: 방식은 {', '.join(METHODS)} 중 하나여야 합니다")
        low, high = THRESHOLD_RANGE[rule["method"]]
        threshold = rule.get("threshold")
        if (
            isinstance(threshold, bool)
            or not isinstance(threshold, (int, float))
            or not low <= threshold <= high
        ):
            method = rule["method"]
            raise ValueError(f"{card_id}: {method} 기준값은 {low}~{high} 사이 숫자여야 합니다")
        rules[card_id] = CardRule(rule["method"], float(threshold))
    return rules


def decide(rule: CardRule, similarity: float, probability: float | None = None) -> bool:
    """카드 방식대로 선택 여부를 정한다. V0052 의 선택 검사와 같은 규칙이다."""
    if rule.method == "cosine":
        return select(similarity, rule.threshold)
    if rule.method == "f4":
        if probability is None:
            raise ValueError("f4 방식은 확률이 있어야 고를 수 있습니다")
        return select(probability, rule.threshold)
    raise ValueError(f"지원하지 않는 방식입니다: {rule.method}")
