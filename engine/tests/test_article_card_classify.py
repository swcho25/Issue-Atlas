"""P4 입력의 안정성과 저장 경계."""

import json
from contextlib import nullcontext

from ai.classify import model, store
from ai.classify.__main__ import (
    choose_sample,
    command_embed_cards,
    command_embed_docs,
    command_score,
)


def test_document_input_is_stable_and_summary_changes_identity():
    first = model.document_input("news-1", " 제목 ", " 요약 ", "raw-1")
    assert first == model.document_input("news-1", "제목", "요약", "raw-1")
    assert first.input_text == "제목: 제목\n요약: 요약"
    assert first.input_id != model.document_input("news-1", "제목", "바뀐 요약", "raw-1").input_id
    assert first.input_id != model.document_input("news-1", "제목", "요약", "raw-2").input_id


def test_card_profile_is_fixed_and_does_not_embed_exclusion():
    spec = {
        "name": "청년 유출·정착",
        "parent_question": "청년은 어디로 떠나는가?",
        "inclusion": ["청년 전입·전출", "정착 사업"],
        "keywords": ["청년 유출", "청년 정착"],
        "exclusion": ["대학 진학 이동"],
    }
    assert model.card_profile(spec) == (
        "이슈: 청년 유출·정착\n질문: 청년은 어디로 떠나는가?\n"
        "포함: 청년 전입·전출 / 정착 사업\n키워드: 청년 유출, 청년 정착"
    )
    assert "대학 진학 이동" not in model.card_profile(spec)


def test_dry_run_embeds_with_fake_provider_without_saving(monkeypatch):
    item = model.document_input("news-1", "제목", "요약", "raw-1")
    saved = []
    monkeypatch.setattr("ai.classify.store.documents", lambda conn: [item])
    monkeypatch.setattr("ai.classify.store.current_document", lambda conn, input_id: None)
    monkeypatch.setattr("ai.classify.store.save_document", lambda *args: saved.append(args))
    monkeypatch.setattr("ai.classify.store.deactivate_missing_documents", lambda conn, ids: 0)
    result = command_embed_docs(None, False, None, embed=lambda text: [0.1] * 1536)
    assert result == {"eligible": 1, "embedded": 1}
    assert saved == []
    command_embed_docs(None, True, None, embed=lambda text: [0.1] * 1536)
    assert len(saved) == 1


def test_unapproved_card_stops_before_embedding(monkeypatch):
    monkeypatch.setattr(
        "ai.classify.store.cards", lambda conn: (_ for _ in ()).throw(RuntimeError())
    )
    try:
        command_embed_cards(None, True, embed=lambda text: [0.1] * 1536)
    except RuntimeError:
        pass
    else:
        raise AssertionError("승인본 누락을 무시했습니다")


def cosine_config(c1=0.7, a3=0.8) -> dict:
    return {
        "version": "v1",
        "cards": {
            "C1": {"method": "cosine", "threshold": c1},
            "A3": {"method": "cosine", "threshold": a3},
        },
    }


def test_score_uses_threshold_and_apply_boundary(monkeypatch, tmp_path):
    path = tmp_path / "thresholds.json"
    path.write_text(json.dumps(cosine_config()))
    rows = [
        ("news:1", "C1", "input-1", 2, "card-profile-v1", 0.71),
        ("news:1", "A3", "input-1", 2, "card-profile-v1", 0.79),
    ]
    saved = []
    monkeypatch.setattr("ai.classify.store.scores", lambda conn: rows)
    monkeypatch.setattr("ai.classify.store.save_scores", lambda *args: saved.append(args))
    result = command_score(None, False, path)
    assert result["selected"] == {"C1": 1}
    assert result["methods"] == {"A3": "cosine", "C1": "cosine"}
    assert saved == []
    command_score(None, True, path)
    assert len(saved) == 1


def test_card_rules_reject_missing_card_unknown_method_and_bad_threshold():
    assert model.card_rules(cosine_config(c1=1)) == {
        "C1": model.CardRule("cosine", 1.0),
        "A3": model.CardRule("cosine", 0.8),
    }

    def with_a3(rule):
        return cosine_config() | {"cards": cosine_config()["cards"] | {"A3": rule}}

    assert model.card_rules(with_a3({"method": "f4", "threshold": 0.5}))["A3"] == model.CardRule(
        "f4", 0.5
    )
    broken = [
        {"version": "v1", "cards": {"C1": {"method": "cosine", "threshold": 0.7}}},
        # 예전 판처럼 기준값만 적은 설정
        {"version": "v1", "cards": {"C1": 0.7, "A3": 0.8}},
        with_a3({"method": "bm25", "threshold": 0.5}),
        # 확률 기준값은 0~1, 코사인은 -1~1
        with_a3({"method": "f4", "threshold": -0.1}),
        with_a3({"method": "f4", "threshold": 1.5}),
        cosine_config(c1=1.5),
        cosine_config(a3=True),
        cosine_config(a3="0.8"),
    ]
    for config in broken:
        try:
            model.card_rules(config)
        except ValueError:
            continue
        raise AssertionError(f"잘못된 설정을 받았습니다: {config}")


class FakeCursor:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))


class FakeConnection:
    def __init__(self):
        self.calls = []

    def transaction(self):
        return nullcontext()

    def cursor(self):
        return FakeCursor(self.calls)


def test_save_scores_writes_method_and_empty_probability_for_cosine():
    conn = FakeConnection()
    rows = [
        ("news:1", "C1", "input-1", 2, "card-profile-v1", 0.7129),
        ("news:1", "A3", "input-1", 2, "card-profile-v1", 0.6669),
    ]
    store.save_scores(conn, rows, model.card_rules(cosine_config(0.7129, 0.667)), "v1")
    inserts = [params for sql, params in conn.calls if "INSERT INTO document_card_score" in sql]
    # (… threshold, selected, method, probability)
    assert [params[-4:] for params in inserts] == [
        (0.7129, True, "cosine", None),
        (0.667, False, "cosine", None),
    ]


def test_save_scores_writes_f4_probability_and_decides_by_it():
    conn = FakeConnection()
    rows = [
        ("news:1", "C1", "input-1", 2, "card-profile-v1", 0.2),
        ("news:1", "A3", "input-1", 2, "card-profile-v1", 0.9),
    ]
    config = {
        "version": "v1",
        "cards": {
            "C1": {"method": "f4", "threshold": 0.5},
            "A3": {"method": "f4", "threshold": 0.5},
        },
    }
    probabilities = {("news:1", "C1"): 0.5, ("news:1", "A3"): 0.1}
    store.save_scores(conn, rows, model.card_rules(config), "v1", probabilities)
    inserts = [params for sql, params in conn.calls if "INSERT INTO document_card_score" in sql]
    # 코사인은 그대로 저장하고, 선택은 확률로 정한다
    assert [(params[6], *params[-4:]) for params in inserts] == [
        (0.2, 0.5, True, "f4", 0.5),
        (0.9, 0.5, False, "f4", 0.1),
    ]


def test_sample_has_three_disjoint_groups():
    rows = [("C1", f"news:{i}", i / 100, 0.5) for i in range(60)]
    picked = choose_sample(rows)
    assert len(picked) == len({row[1] for row in picked}) == 30
    assert {row[1] for row in picked[:10]} == {f"news:{i}" for i in range(50, 60)}
