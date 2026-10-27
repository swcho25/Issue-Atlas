"""페이지 HTML → 기사 본문, 그리고 빅카인즈가 준 기사와 같은 글인지 확인."""

import re
import unicodedata

import trafilatura

MIN_BODY = 100  # 이보다 짧으면 본문을 못 뽑은 것으로 본다 (영상 기사 · 목록 페이지 등)
WINDOW = 30  # 빅카인즈 content 에서 떼어 본문에서 찾는 조각 길이 (공백 뺀 글자)
OFFSETS = (0, 60, 120)  # 추출기가 첫 줄(기자 이름 등)을 빼도 뒷부분 조각으로 찾는다


def extract_body(html: bytes) -> str | None:
    if not html:
        return None
    text = trafilatura.extract(html, favor_precision=True, include_comments=False)
    return text if text and len(text) >= MIN_BODY else None


def has_reference(content: str | None) -> bool:
    return len(_squash(content)) >= WINDOW


def same_article(body: str, content: str) -> bool:
    """빅카인즈 content(본문 앞 200자)의 조각이 본문에 그대로 있으면 같은 기사로 본다."""
    reference, text = _squash(content), _squash(body)
    pieces = [reference[i : i + WINDOW] for i in OFFSETS]
    return any(len(piece) == WINDOW and piece in text for piece in pieces)


def _squash(text: str | None) -> str:
    return re.sub(r"\s", "", unicodedata.normalize("NFKC", text or ""))
