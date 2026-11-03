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
