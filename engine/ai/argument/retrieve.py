"""⑤ 반박마다 근거 기사 고르기(R3, S15P31C108-326).

backend 가 질문 지역 · 기간의 기사(요약 · 반박 질의 코사인)를 요청 `rebuttal_search` 로 넘기면,
반박마다 score = 0.5 × 코사인 + 0.5 × 글자 조각 TF-IDF 유사도 상위 K 건을 고른다.
TF-IDF 는 미리 저장하지 않고 그 지역 · 기간 기사 요약으로 그때 만든다. 전역으로 미리 만든
TF-IDF 는 반박 실험에서 2023–2025 적중이 62% → 46% 로 떨어졌다.
계산은 scikit-learn `TfidfVectorizer(analyzer="char", ngram_range=(2, 4), sublinear_tf=True)`
와 같다(engine 이미지에 scikit-learn 이 없어 직접 계산한다).
반박 실험(로컬 전용) 확인 실험 B6 와 같은 설정이다. 점수 하한은 두지 않는다.
"""

import math
from collections import Counter

from ai.classify.f4 import char_ngrams

METHOD = "rebuttal_r3"
FALLBACK = "card_tags"
K = 5


class LexicalIndex:
    """기사 묶음 하나로 맞춘 글자 2~4조각 TF-IDF.

    idf = ln((1 + n) / (1 + df)) + 1, 조각 수는 1 + ln(개수), idf 를 곱한 뒤 L2 정규화.
    묶음에 없는 조각은 질의에서 버린다.
    """

    def __init__(self, texts: list[str]):
        counts = [Counter(char_ngrams(text)) for text in texts]
        df = Counter(gram for count in counts for gram in count)
        n = len(texts)
        self.idf = {gram: math.log((1 + n) / (1 + d)) + 1 for gram, d in df.items()}
        self.docs = [self.vector(count) for count in counts]

    def vector(self, count: Counter) -> dict[str, float]:
        weights = {
            gram: (1 + math.log(c)) * self.idf[gram]
            for gram, c in count.items()
            if gram in self.idf
        }
        norm = math.sqrt(sum(w * w for w in weights.values()))
        return {gram: w / norm for gram, w in weights.items()} if norm else {}

    def similarities(self, text: str) -> list[float]:
        query = self.vector(Counter(char_ngrams(text)))
        return [sum(w * doc.get(gram, 0.0) for gram, w in query.items()) for doc in self.docs]


def card_tags(count: int) -> dict:
    """검색 없이 요청 `articles`(카드 꼬리표 기사 날짜순, 앞 40건)를 쓴 경우의 기록"""
    return {"method": FALLBACK, "query_version": None, "k": None, "candidates": count, "picked": []}


def asks(search: dict | None, asked: list[str]) -> bool:
    """검색할 수 있는가: 모델에 물을 반박 중 하나라도 질의가 있다"""
    return bool(search) and any(q["id"] in asked for q in search["queries"])


def select(search: dict, asked: list[str]) -> tuple[list[dict], dict]:
    """search = 요청 `rebuttal_search`, asked = 모델에 물을 반박 ID(카드 순서).

    반박 순서대로 상위 K 건을 합치고 겹치는 기사는 처음 한 번만 둔다. 같은 점수는 기사 ID 순.
    돌려주는 값: 근거로 쓸 기사(C2 article 모양, 고른 순서) · 검색 기록(반박 · 순위 · 점수).
    기사 ID 가 겹치거나 물을 반박의 코사인이 빠졌으면 ValueError.
    """
    queries = {q["id"]: q["text"] for q in search["queries"]}
    articles = search["articles"]
    if len({a["id"] for a in articles}) != len(articles):
        raise ValueError("rebuttal_search.articles 에 같은 기사 ID 가 있습니다")
    index = LexicalIndex([a.get("summary") or "" for a in articles])
    chosen, picked = {}, []
    for rid in (rid for rid in asked if rid in queries):
        scored = []
        for article, lexical in zip(articles, index.similarities(queries[rid]), strict=True):
            cosine = article["cosine"].get(rid)
            if cosine is None:
                raise ValueError(f"rebuttal_search.articles 에 {rid} 코사인이 없습니다")
            scored.append((0.5 * cosine + 0.5 * lexical, article["id"], cosine, lexical, article))
        scored.sort(key=lambda row: (-row[0], row[1]))
        for rank, (score, article_id, cosine, lexical, article) in enumerate(scored[:K], 1):
            picked.append(
                {
                    "rebuttal": rid,
                    "rank": rank,
                    "source_id": article_id,
                    "score": round(score, 4),
                    "cosine": round(cosine, 4),
                    "lexical": round(lexical, 4),
                }
            )
            chosen.setdefault(article_id, article)
    retrieval = {
        "method": METHOD,
        "query_version": search["query_version"],
        "k": K,
        "candidates": len(articles),
        "picked": picked,
    }
    return list(chosen.values()), retrieval
