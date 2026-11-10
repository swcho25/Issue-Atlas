"""F4 학습 분류기: 순수 Python 추론이 scikit-learn 과 같은지, 모델 파일 검사, score 의 f4 경로."""

import json
import math
import random
from pathlib import Path

import numpy as np
import pytest
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from ai.classify import f4, model
from ai.classify.__main__ import command_score, command_train

WORDS = [
    "청년",
    "전입",
    "전출",
    "인구",
    "순유출",
    "정착",
    "일자리",
    "미세먼지",
    "초미세먼지",
    "PM2.5",
    "대기",
    "농도",
    "측정소",
    "여수",
    "광주",
    "주거",
    "지원",
    "사업",
    "Seoul",
    "AIR",
]


def unit(vector):
    length = math.sqrt(sum(v * v for v in vector))
    return [v / length for v in vector]


def corpus(seed: int, count: int):
    rng = random.Random(seed)
    articles = {}
    for k in range(count):
        title = " ".join(rng.choice(WORDS) for _ in range(rng.randint(2, 5)))
        summary = "  ".join(rng.choice(WORDS) for _ in range(rng.randint(4, 12)))
        # pgvector 처럼 길이가 1 에서 조금 어긋난 벡터
        vector = [x * (1 + 1e-7) for x in unit([rng.gauss(0, 1) for _ in range(model.DIMENSIONS)])]
        articles[f"n{seed}-{k}"] = {
            "input_text": f"제목: {title}\n요약: {summary}",
            "embedding": vector,
        }
    return articles


def payload():
    articles = corpus(1, 40)
    ids = sorted(articles)
    cards = {}
    for c, card_id in enumerate(("C1", "A3")):
        pool = ids[c:]
        labels = {
            news_id: int(("청년" in articles[news_id]["input_text"]) ^ (c == 1)) for news_id in pool
        }
        train = [{"news_id": news_id, "label": labels[news_id]} for news_id in pool[::-1][:30]]
        cards[card_id] = {"pool": pool, "train": train}
    return {"version": "f4-test", "label_status": "테스트", "articles": articles, "cards": cards}


def sklearn_probabilities(data, card_id, tests):
    spec = data["cards"][card_id]
    pool = spec["pool"]
    vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(2, 4), min_df=2, sublinear_tf=True)
    text = vectorizer.fit_transform([data["articles"][i]["input_text"] for i in pool])
    vectors = np.asarray([unit(data["articles"][i]["embedding"]) for i in pool])
    features = hstack([text, csr_matrix(4 * vectors)]).tocsr()
    position = {news_id: k for k, news_id in enumerate(pool)}
    chosen = [position[item["news_id"]] for item in spec["train"]]
    classifier = LogisticRegression(C=1, class_weight="balanced", max_iter=2000).fit(
        features[chosen], [item["label"] for item in spec["train"]]
    )
    test_features = hstack(
        [
            vectorizer.transform([item["input_text"] for item in tests]),
            csr_matrix(4 * np.asarray([unit(item["embedding"]) for item in tests])),
        ]
    ).tocsr()
    return classifier.predict_proba(test_features)[:, 1]


def test_char_ngrams_match_scikit_learn_analyzer():
    analyzer = TfidfVectorizer(analyzer="char", ngram_range=(2, 4)).build_analyzer()
    for text in [
        "제목: 청년 AIR\n요약:  PM2.5   농도",
        "a",
        "",
        "ab",
        "Seoul\t\t광주 ",
        "  \n\n 여수",
    ]:
        assert f4.char_ngrams(text) == analyzer(text)


def test_pure_python_probability_matches_scikit_learn():
    data = payload()
    classifier = f4.parse(f4.train(data))
    tests = list(corpus(2, 25).values())
    # 사전에 있는 조각이 하나도 없는 문장도 확률이 같아야 한다
    tests.append({"input_text": "zzzz", "embedding": tests[0]["embedding"]})
    for card_id in ("C1", "A3"):
        expected = sklearn_probabilities(data, card_id, tests)
        actual = [
            classifier.cards[card_id].probability(item["input_text"], item["embedding"])
            for item in tests
        ]
        assert max(abs(a - e) for a, e in zip(actual, expected, strict=True)) < 1e-9


def test_model_file_round_trips_and_rejects_mismatched_settings():
    trained = f4.train(payload())
    assert json.loads(f4.dumps(trained)) == trained
    assert set(f4.parse(json.loads(f4.dumps(trained))).cards) == {"C1", "A3"}
    broken = [
        trained | {"input_version": "news-title-body-v1"},
        trained | {"dimensions": 768},
        trained | {"embedding_weight": 2},
        trained | {"version": ""},
        trained | {"cards": {"C1": trained["cards"]["C1"]}},
        trained | {"cards": trained["cards"] | {"A3": []}},
        trained | {"cards": trained["cards"] | {"A3": trained["cards"]["A3"] | {"idf": [1.0]}}},
        trained
        | {
            "cards": trained["cards"]
            | {
                "A3": trained["cards"]["A3"]
                | {"ngrams": ["ab"] * len(trained["cards"]["A3"]["ngrams"])}
            }
        },
        trained
        | {"cards": trained["cards"] | {"C1": trained["cards"]["C1"] | {"intercept": math.nan}}},
    ]
    for data in broken:
        with pytest.raises(ValueError):
            f4.parse(data)


def test_train_rejects_bad_payload():
    good = payload()
    one_class = json.loads(json.dumps(good))
    one_class["cards"]["C1"]["train"] = [
        dict(item, label=1) for item in good["cards"]["C1"]["train"]
    ]
    outside = json.loads(json.dumps(good))
    outside["cards"]["A3"]["train"].append({"news_id": "없는-기사", "label": 0})
    short = json.loads(json.dumps(good))
    short["articles"][good["cards"]["C1"]["pool"][0]]["embedding"] = [0.1] * 10
    for data in (one_class, outside, short, good | {"version": ""}):
        with pytest.raises(ValueError):
            f4.train(data)


def test_probability_rejects_wrong_or_zero_vector():
    card = f4.parse(f4.train(payload())).cards["C1"]
    with pytest.raises(ValueError):
        card.probability("청년", [0.1] * 10)
    with pytest.raises(ValueError):
        card.probability("청년", [0.0] * model.DIMENSIONS)


def test_repository_model_matches_thresholds_version():
    root = Path(__file__).resolve().parents[1] / "ai" / "classify"
    config = json.loads((root / "thresholds.json").read_text(encoding="utf-8"))
    classifier = f4.load()
    assert classifier.version == config["version"] == "f4-al128-v1"
    assert model.card_rules(config) == {
        "C1": model.CardRule("f4", 0.5),
        "A3": model.CardRule("f4", 0.5),
    }
    raw = json.loads(f4.MODEL_FILE.read_text(encoding="utf-8"))
    assert raw["trained_with"] == {"scikit-learn": "1.9.1"}
    assert {c: (v["pool_count"], v["train_count"]) for c, v in raw["cards"].items()} == {
        "C1": (331, 128),
        "A3": (333, 128),
    }


@pytest.fixture
def scoring(tmp_path, monkeypatch):
    data = payload()
    model_path = tmp_path / "f4_model.json"
    model_path.write_text(f4.dumps(f4.train(data)), encoding="utf-8")
    config = tmp_path / "thresholds.json"
    config.write_text(
        json.dumps(
            {
                "version": "f4-test",
                "cards": {
                    "C1": {"method": "f4", "threshold": 0.5},
                    "A3": {"method": "cosine", "threshold": 0.7},
                },
            }
        ),
        encoding="utf-8",
    )
    tests = corpus(3, 6)
    rows = [
        (f"news:{news_id}", card_id, f"input:{news_id}", 1, "card-profile-v1", 0.75)
        for news_id in tests
        for card_id in ("C1", "A3")
    ]
    inputs = [
        (f"input:{news_id}", item["input_text"], model.INPUT_VERSION, item["embedding"])
        for news_id, item in tests.items()
    ]
    saved = []
    monkeypatch.setattr("ai.classify.store.scores", lambda conn: rows)
    monkeypatch.setattr("ai.classify.store.score_inputs", lambda conn: iter(inputs))
    monkeypatch.setattr("ai.classify.store.save_scores", lambda *args: saved.append(args))
    return {
        "data": data,
        "tests": tests,
        "model": model_path,
        "config": config,
        "saved": saved,
        "inputs": inputs,
    }


def test_score_uses_f4_probability_for_f4_cards_only(scoring):
    expected = sklearn_probabilities(scoring["data"], "C1", list(scoring["tests"].values()))
    result = command_score(None, True, scoring["config"], scoring["model"])
    assert result["methods"] == {"A3": "cosine", "C1": "f4"}
    assert result["selected"]["A3"] == len(scoring["tests"])
    assert result["selected"].get("C1", 0) == int(sum(p >= 0.5 for p in expected))
    ((_, rows, rules, version, probabilities),) = scoring["saved"]
    assert version == "f4-test" and rules["C1"].method == "f4"
    assert set(probabilities) == {(f"news:{news_id}", "C1") for news_id in scoring["tests"]}
    actual = [probabilities[f"news:{news_id}", "C1"] for news_id in scoring["tests"]]
    assert max(abs(a - e) for a, e in zip(actual, expected, strict=True)) < 1e-9


def test_score_stops_on_version_mismatch_missing_input_or_other_input_version(scoring, monkeypatch):
    config = json.loads(scoring["config"].read_text(encoding="utf-8"))
    scoring["config"].write_text(json.dumps(config | {"version": "f4-other"}), encoding="utf-8")
    with pytest.raises(ValueError):
        command_score(None, False, scoring["config"], scoring["model"])
    scoring["config"].write_text(json.dumps(config), encoding="utf-8")
    monkeypatch.setattr("ai.classify.store.score_inputs", lambda conn: iter(scoring["inputs"][1:]))
    with pytest.raises(RuntimeError):
        command_score(None, False, scoring["config"], scoring["model"])
    other = [(i, t, "news-title-body-v1", e) for i, t, _, e in scoring["inputs"]]
    monkeypatch.setattr("ai.classify.store.score_inputs", lambda conn: iter(other))
    with pytest.raises(ValueError):
        command_score(None, False, scoring["config"], scoring["model"])
    assert scoring["saved"] == []


def test_train_command_writes_loadable_model(tmp_path):
    source = tmp_path / "train_input.json"
    source.write_text(json.dumps(payload(), ensure_ascii=False), encoding="utf-8")
    output = tmp_path / "model.json"
    result = command_train(source, output)
    assert result["version"] == "f4-test"
    assert f4.load(output).version == "f4-test"
