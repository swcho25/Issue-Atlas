"""F4 학습 분류기: 제목·요약 글자 2~4조각 TF-IDF + Gemini 벡터×4 → 로지스틱 확률.

- 학습(`train`)은 scikit-learn(engine dev 의존성)으로 하고 결과를 모델 파일
  (`f4_model.json`)로 남긴다.
- 추론(`F4Model.probability`)은 scikit-learn 없이 모델 파일만으로 계산한다.
  engine 이미지는 `--no-dev` 다.
- 전처리는 scikit-learn `TfidfVectorizer(analyzer="char")` 와 같다: 소문자,
  연속 공백 → 한 칸, 2~4글자 조각. 조각 수는 1 + ln(개수)(sublinear), idf 를 곱한 뒤
  L2 정규화한다.
- 벡터는 단위 길이로 맞춘 뒤 4배 한다. DB(pgvector)는 float32 라 길이가 1 에서 조금 어긋나고,
  학습 벡터도 단위 길이였다.
"""

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from .model import CARD_IDS, DIMENSIONS, INPUT_VERSION, MODEL

MODEL_FILE = Path(__file__).with_name("f4_model.json")
NGRAM_RANGE = (2, 4)
MIN_DF = 2
EMBEDDING_WEIGHT = 4
LOGISTIC = {"C": 1.0, "class_weight": "balanced", "max_iter": 2000}
WHITESPACE = re.compile(r"\s\s+")


def char_ngrams(text: str) -> list[str]:
    doc = WHITESPACE.sub(" ", text.lower())
    low, high = NGRAM_RANGE
    return [
        doc[i : i + n] for n in range(low, min(high, len(doc)) + 1) for i in range(len(doc) - n + 1)
    ]


def sigmoid(z: float) -> float:
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    e = math.exp(z)
    return e / (1 + e)


@dataclass(frozen=True)
class CardModel:
    index: dict[str, int]
    idf: list[float]
    text_coef: list[float]
    embedding_coef: list[float]
    intercept: float

    def probability(self, text: str, embedding: list[float]) -> float:
        counts = Counter(gram for gram in char_ngrams(text) if gram in self.index)
        weights = {
            self.index[gram]: (1 + math.log(count)) * self.idf[self.index[gram]]
            for gram, count in counts.items()
        }
        norm = math.sqrt(sum(weight * weight for weight in weights.values()))
        z = self.intercept
        if norm:
            z += sum(weight * self.text_coef[i] for i, weight in weights.items()) / norm
        if len(embedding) != len(self.embedding_coef):
            expected = len(self.embedding_coef)
            raise ValueError(f"벡터 차원이 {expected} 이어야 합니다: {len(embedding)}")
        length = math.sqrt(sum(value * value for value in embedding))
        if not length:
            raise ValueError("길이가 0 인 벡터는 확률을 낼 수 없습니다")
        z += EMBEDDING_WEIGHT * math.fsum(
            value / length * coef
            for value, coef in zip(embedding, self.embedding_coef, strict=True)
        )
        return sigmoid(z)


@dataclass(frozen=True)
class F4Model:
    version: str
    label_status: str
    cards: dict[str, CardModel]


def _numbers(values, length: int, name: str) -> list[float]:
    if (
        not isinstance(values, list)
        or len(values) != length
        or not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values)
        or not all(math.isfinite(v) for v in values)
    ):
        raise ValueError(f"F4 모델 파일의 {name} 은 유한한 숫자 {length}개여야 합니다")
    return [float(v) for v in values]


def parse(data: dict) -> F4Model:
    """모델 파일 dict → F4Model. 입력 판 · 임베딩 모델 · 차원 · 특징 설정이 코드와 같아야 한다."""
    expected = {
        "input_version": INPUT_VERSION,
        "embedding_model": MODEL,
        "dimensions": DIMENSIONS,
        "embedding_weight": EMBEDDING_WEIGHT,
        "ngram_range": list(NGRAM_RANGE),
    }
    for key, value in expected.items():
        if data.get(key) != value:
            raise ValueError(f"F4 모델 파일의 {key} 가 {value!r} 이어야 합니다: {data.get(key)!r}")
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise ValueError("F4 모델 파일에 판(version)이 필요합니다")
    cards = data.get("cards")
    if not isinstance(cards, dict) or set(cards) != CARD_IDS:
        raise ValueError("F4 모델 파일에 C1 · A3 가 모두 필요합니다")
    parsed = {}
    for card_id, card in cards.items():
        if not isinstance(card, dict):
            raise ValueError(f"{card_id}: F4 모델 카드 항목은 객체여야 합니다")
        ngrams = card.get("ngrams")
        if (
            not isinstance(ngrams, list)
            or not ngrams
            or not all(isinstance(g, str) for g in ngrams)
            or len(set(ngrams)) != len(ngrams)
        ):
            raise ValueError(f"{card_id}: F4 글자 조각 목록이 비었거나 겹칩니다")
        intercept = _numbers([card.get("intercept")], 1, f"{card_id} intercept")[0]
        parsed[card_id] = CardModel(
            {gram: i for i, gram in enumerate(ngrams)},
            _numbers(card.get("idf"), len(ngrams), f"{card_id} idf"),
            _numbers(card.get("text_coef"), len(ngrams), f"{card_id} text_coef"),
            _numbers(card.get("embedding_coef"), DIMENSIONS, f"{card_id} embedding_coef"),
            intercept,
        )
    return F4Model(version, str(data.get("label_status", "")), parsed)


def load(path: Path = MODEL_FILE) -> F4Model:
    return parse(json.loads(path.read_text(encoding="utf-8")))


def _check_payload(payload: dict) -> None:
    if not isinstance(payload.get("version"), str) or not payload["version"]:
        raise ValueError("학습 입력에 판(version)이 필요합니다")
    articles = payload.get("articles")
    cards = payload.get("cards")
    if not isinstance(articles, dict) or not isinstance(cards, dict) or set(cards) != CARD_IDS:
        raise ValueError("학습 입력에 articles 와 C1 · A3 cards 가 필요합니다")
    for card_id, spec in cards.items():
        pool = spec.get("pool", [])
        picked = [item.get("news_id") for item in spec.get("train", [])]
        labels = {item.get("label") for item in spec.get("train", [])}
        unique = len(set(pool)) == len(pool) and len(set(picked)) == len(picked)
        if not unique or not set(picked) <= set(pool):
            raise ValueError(f"{card_id}: 학습 기사는 겹치지 않고 풀 안에 있어야 합니다")
        if labels != {0, 1}:
            raise ValueError(f"{card_id}: 라벨은 0 · 1 이 둘 다 있어야 합니다")
        for news_id in pool:
            article = articles.get(news_id)
            if not isinstance(article, dict) or not isinstance(article.get("input_text"), str):
                raise ValueError(f"{card_id}: 기사 {news_id} 의 입력 문장이 없습니다")
            if len(article.get("embedding", [])) != DIMENSIONS:
                raise ValueError(f"{card_id}: 기사 {news_id} 의 벡터가 {DIMENSIONS}차원이 아닙니다")


def train(payload: dict) -> dict:
    """학습 입력 → 모델 파일 dict. scikit-learn(dev 의존성)이 필요하다.

    payload: {version, label_status, source, articles: {news_id: {input_text, embedding}},
              cards: {C1|A3: {pool: [news_id, …] (TF-IDF 사전 범위), train: [{news_id, label}, …]}}}
    """
    try:
        import numpy as np
        import sklearn
        from scipy.sparse import csr_matrix, hstack
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
    except ImportError as error:
        raise RuntimeError("train 은 scikit-learn 이 필요합니다(engine dev 의존성)") from error
    _check_payload(payload)
    articles = payload["articles"]
    cards = {}
    for card_id in sorted(CARD_IDS):
        spec = payload["cards"][card_id]
        pool = spec["pool"]
        vectorizer = TfidfVectorizer(
            analyzer="char", ngram_range=NGRAM_RANGE, min_df=MIN_DF, sublinear_tf=True
        )
        text_features = vectorizer.fit_transform([articles[i]["input_text"] for i in pool])
        vectors = np.asarray([articles[i]["embedding"] for i in pool], dtype=float)
        vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        features = hstack([text_features, csr_matrix(EMBEDDING_WEIGHT * vectors)]).tocsr()
        position = {news_id: k for k, news_id in enumerate(pool)}
        chosen = [position[item["news_id"]] for item in spec["train"]]
        labels = [int(item["label"]) for item in spec["train"]]
        classifier = LogisticRegression(**LOGISTIC).fit(features[chosen], labels)
        ngrams = [""] * len(vectorizer.vocabulary_)
        for gram, i in vectorizer.vocabulary_.items():
            ngrams[i] = gram
        coef = classifier.coef_[0].tolist()
        cards[card_id] = {
            "pool_count": len(pool),
            "train_count": len(chosen),
            "positive_count": sum(labels),
            "intercept": float(classifier.intercept_[0]),
            "ngrams": ngrams,
            "idf": vectorizer.idf_.tolist(),
            "text_coef": coef[: len(ngrams)],
            "embedding_coef": coef[len(ngrams) :],
        }
    return {
        "version": payload["version"],
        "label_status": payload.get("label_status", ""),
        "input_version": INPUT_VERSION,
        "embedding_model": MODEL,
        "dimensions": DIMENSIONS,
        "embedding_weight": EMBEDDING_WEIGHT,
        "ngram_range": list(NGRAM_RANGE),
        "min_df": MIN_DF,
        "logistic": LOGISTIC,
        "trained_with": {"scikit-learn": sklearn.__version__},
        "source": payload.get("source", {}),
        "cards": cards,
    }


def dumps(model: dict) -> str:
    """윗단 칸은 한 줄씩, 카드별 큰 배열은 한 줄로. diff 에서 바뀐 칸이 보이게 한다."""
    lines = ["{"]
    keys = list(model)
    for k, key in enumerate(keys):
        comma = "," if k < len(keys) - 1 else ""
        if key != "cards":
            value = json.dumps(model[key], ensure_ascii=False)
            lines.append(f"  {json.dumps(key)}: {value}{comma}")
            continue
        lines.append('  "cards": {')
        card_ids = list(model["cards"])
        for c, card_id in enumerate(card_ids):
            card = model["cards"][card_id]
            lines.append(f"    {json.dumps(card_id)}: {{")
            fields = list(card)
            for f, field in enumerate(fields):
                value = json.dumps(card[field], ensure_ascii=False, separators=(",", ":"))
                tail = "," if f < len(fields) - 1 else ""
                lines.append(f"      {json.dumps(field)}: {value}{tail}")
            lines.append("    }" + ("," if c < len(card_ids) - 1 else ""))
        lines.append("  }" + comma)
    lines.append("}")
    return "\n".join(lines) + "\n"
