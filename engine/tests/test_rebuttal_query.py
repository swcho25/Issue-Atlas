"""⑤ 반박 검색 질의(S15P31C108-326): 질의 문장 · embed-cards 저장 경계 · 활성 전환."""

from contextlib import nullcontext

from ai.classify import model, store
from ai.classify.__main__ import command_embed_cards

SPEC = {
    "name": "대기질 악화",
    "rebuttals": {
        "status": "draft",
        "items": [
            {"id": " A3-R1 ", "text": " 기상 변동(강수일 · 풍향 · 정체) "},
            {"id": "A3-R2", "text": ""},
            {"id": "", "text": "ID 없는 반박"},
            {"id": "A3-R4", "text": "등급 기준값 개정"},
        ],
    },
}


def test_rebuttal_queries_prefix_card_name_and_skip_empty_items():
    assert model.rebuttal_queries(SPEC) == [
        ("A3-R1", "대기질 악화의 다른 설명: 기상 변동(강수일 · 풍향 · 정체)"),
        ("A3-R4", "대기질 악화의 다른 설명: 등급 기준값 개정"),
    ]
    assert model.rebuttal_queries({"name": "반박 없음"}) == []


class Recorder:
    """embed-cards 가 부르는 store 함수를 가짜로 바꾸고 부른 순서를 남긴다."""

    def __init__(self, monkeypatch, rebuttal_state=None, card_state=True):
        self.saved = []
        self.deactivated = []
        self.embedded = []
        rebuttal_state = rebuttal_state or {}
        rebuttals = [
            ("A3", 4, "A3-R1", "대기질 악화의 다른 설명: 기상 변동"),
            ("A3", 4, "A3-R4", "대기질 악화의 다른 설명: 등급 기준값 개정"),
        ]
        monkeypatch.setattr(store, "cards", lambda conn: [("A3", 4, "이슈: 대기질 악화")])
        monkeypatch.setattr(store, "current_card", lambda *args: card_state)
        monkeypatch.setattr(store, "save_card", lambda *args: self.saved.append(("card", *args)))
        monkeypatch.setattr(store, "card_rebuttals", lambda conn: rebuttals)
        monkeypatch.setattr(
            store,
            "current_rebuttal",
            lambda conn, card_id, version, rebuttal_id, query_hash: rebuttal_state.get(rebuttal_id),
        )
        monkeypatch.setattr(
            store, "save_rebuttal", lambda *args: self.saved.append(("rebuttal", *args[1:4]))
        )

        def deactivate(conn, keep):
            self.deactivated.append(keep)
            return 1

        monkeypatch.setattr(store, "deactivate_missing_rebuttals", deactivate)

    def embed(self, text):
        self.embedded.append(text)
        return [0.1] * model.DIMENSIONS


def test_embed_cards_dry_run_embeds_rebuttals_without_saving(monkeypatch):
    recorder = Recorder(monkeypatch)
    result = command_embed_cards(None, False, embed=recorder.embed)
    assert result == {
        "approved": 1,
        "already_active": 1,
        "rebuttals": 2,
        "rebuttal_embedded": 2,
        "profile_version": model.PROFILE_VERSION,
        "rebuttal_query_version": model.REBUTTAL_QUERY_VERSION,
    }
    assert recorder.embedded == [
        "대기질 악화의 다른 설명: 기상 변동",
        "대기질 악화의 다른 설명: 등급 기준값 개정",
    ]
    assert recorder.saved == recorder.deactivated == []


def test_embed_cards_apply_skips_active_reactivates_and_turns_off_missing(monkeypatch):
    # R1 은 같은 판 · 같은 질의가 이미 활성, R4 는 같은 질의가 꺼져 있다 → 둘 다 GMS 를 부르지 않는다
    recorder = Recorder(monkeypatch, rebuttal_state={"A3-R1": True, "A3-R4": False})
    result = command_embed_cards(None, True, embed=recorder.embed)
    assert result["rebuttal_already_active"] == 1
    assert result["rebuttal_reactivated"] == 1
    assert result["rebuttal_deactivated"] == 1
    assert "rebuttal_embedded" not in result
    assert recorder.embedded == []
    assert recorder.saved == [("rebuttal", "A3", 4, "A3-R4")]
    assert recorder.deactivated == [{("A3", 4, "A3-R1"), ("A3", 4, "A3-R4")}]


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.conn.calls.append((" ".join(sql.split()), params))

    def fetchall(self):
        return self.conn.rows


class FakeConnection:
    def __init__(self, rows=()):
        self.calls = []
        self.rows = list(rows)

    def transaction(self):
        return nullcontext()

    def cursor(self):
        return FakeCursor(self)


def test_save_rebuttal_turns_off_old_active_then_inserts_with_query_version_and_hash():
    conn = FakeConnection()
    text = "대기질 악화의 다른 설명: 기상 변동"
    store.save_rebuttal(conn, "A3", 4, "A3-R1", text, [0.1] * model.DIMENSIONS)
    lock, off, insert = conn.calls
    assert lock[1] == ("A3|A3-R1",)
    assert off[0].startswith("UPDATE card_rebuttal_profile SET is_active = false")
    assert off[1] == ("A3", "A3-R1")
    assert insert[0].startswith("INSERT INTO card_rebuttal_profile")
    assert insert[1][:7] == (
        "A3",
        4,
        "A3-R1",
        model.REBUTTAL_QUERY_VERSION,
        text,
        model.digest(text),
        model.MODEL,
    )

    conn = FakeConnection()
    store.save_rebuttal(conn, "A3", 4, "A3-R1", text, None)
    assert conn.calls[-1][0].startswith("UPDATE card_rebuttal_profile SET is_active = true")
    assert conn.calls[-1][1] == ("A3", 4, "A3-R1", model.REBUTTAL_QUERY_VERSION)


def test_deactivate_missing_rebuttals_turns_off_removed_old_version_and_old_query_version():
    conn = FakeConnection(
        [
            ("A3", 4, "A3-R1", model.REBUTTAL_QUERY_VERSION),  # 지금 승인본 → 둔다
            ("A3", 3, "A3-R4", model.REBUTTAL_QUERY_VERSION),  # 옛 카드 판
            ("A3", 4, "A3-R9", model.REBUTTAL_QUERY_VERSION),  # 승인본에서 빠진 반박
            ("C1", 4, "C1-R1", "rebuttal-query-v0"),  # 옛 질의 판
        ]
    )
    keep = {("A3", 4, "A3-R1"), ("A3", 4, "A3-R4"), ("C1", 4, "C1-R1")}
    assert store.deactivate_missing_rebuttals(conn, keep) == 3
    updates = [params for sql, params in conn.calls if sql.startswith("UPDATE")]
    assert updates == [
        ("A3", 3, "A3-R4", model.REBUTTAL_QUERY_VERSION),
        ("A3", 4, "A3-R9", model.REBUTTAL_QUERY_VERSION),
        ("C1", 4, "C1-R1", "rebuttal-query-v0"),
    ]
