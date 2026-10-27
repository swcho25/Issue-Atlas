"""기사 본문 수집 · 요약: 빅카인즈 원문 링크 → 언론사 페이지 → 본문 → 요약.

robots.txt 가 막은 주소는 요청하지 않고, 같은 사이트 요청 사이에 간격을 둔다.
본문은 빅카인즈 content 와 같은 기사일 때만 남긴다.
"""

from .run import FETCHER, fetch_articles
from .summarize import LEAD3, Summarizer

__all__ = ["FETCHER", "LEAD3", "Summarizer", "fetch_articles"]
