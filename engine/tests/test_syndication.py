"""기사 전재 묶기 규칙 syn-0.1 (S15P31C108-267). 제목은 개발 DB 의 실제 기사 제목(11/5 측정 표본)."""

from datetime import UTC, datetime, timedelta, timezone

from pipeline.refine.syndication import (
    THRESHOLD,
    Article,
    bigrams,
    group,
    normalize_title,
    similarity,
)

KST = timezone(timedelta(hours=9))


def at(day: str, hour: int = 9) -> datetime:
    return datetime.fromisoformat(f"{day}T{hour:02d}:00:00").replace(tzinfo=KST)


def sim(a: str, b: str) -> float:
    return similarity(bigrams(normalize_title(a)), bigrams(normalize_title(b)))


def test_normalize_drops_brackets_symbols_and_spaces():
    assert (
        normalize_title("[단독] 광주시, '겨울철' 노로바이러스 (종합)") == "광주시겨울철노로바이러스"
    )
    assert normalize_title("GH, 매입임대주택…") == "gh매입임대주택"
    assert normalize_title("") == ""


def test_same_news_from_two_outlets_is_one_group_led_by_the_earlier():
    a = Article("b-later", "광주시 “겨울철 노로바이러스 주의하세요”", at("2025-12-02", 11))
    b = Article("a-earlier", "광주시, 겨울철 노로바이러스 주의 당부", at("2025-12-02", 9))
    assert sim(a.title, b.title) >= THRESHOLD
    assert group([a, b]) == {"a-earlier": ("a-earlier", 2), "b-later": ("a-earlier", 2)}


def test_different_organizations_at_the_same_campaign_stay_apart():
    # 0.6 이면 묶이던 사례 — 기관이 다르면 다른 소식
    a = Article("x1", "기아오토랜드광주, 희망2026 나눔캠페인 성금전달", at("2025-12-01"))
    b = Article("x2", "광주은행, '희망 2026 나눔캠페인' 성금 전달", at("2025-12-01"))
    assert sim(a.title, b.title) < THRESHOLD
    assert group([a, b]) == {"x1": ("x1", 1), "x2": ("x2", 1)}


def test_same_title_more_than_three_days_apart_is_not_syndication():
    a = Article("y1", "광주경찰청, 연말연시 음주운전 특별단속 실시", at("2025-12-01"))
    b = Article("y2", "광주경찰청, 연말연시 음주운전 특별단속 실시", at("2025-12-04"))
    c = Article("y3", "광주경찰청, 연말연시 음주운전 특별단속 실시", at("2025-12-05"))
    groups = group([a, b, c])
    # 1일 ↔ 4일은 3일 안, 4일 ↔ 5일도 3일 안 → 이어져 한 묶음(연결 요소)
    assert groups["y1"] == groups["y2"] == groups["y3"] == ("y1", 3)
    alone = group([a, c])
    assert alone == {"y1": ("y1", 1), "y3": ("y3", 1)}


def test_window_uses_korean_date():
    # 한국 시각 12-01 23:30 과 12-05 00:30 — UTC 로는 3일 안처럼 보여도 한국 날짜로 4일 차이
    a = Article(
        "z1",
        "여수시, 공공심야어린이병원 운영 종료",
        datetime(2025, 12, 1, 14, 30, tzinfo=UTC),
    )
    b = Article(
        "z2",
        "여수시, 공공심야어린이병원 운영 종료",
        datetime(2025, 12, 4, 15, 30, tzinfo=UTC),
    )
    assert group([a, b]) == {"z1": ("z1", 1), "z2": ("z2", 1)}


def test_same_time_ties_break_by_news_id():
    a = Article("n2", "광주시, 노인일자리 3만6440명 모집", at("2025-12-01"))
    b = Article("n1", "광주시, 노인일자리 3만6440명 모집", at("2025-12-01"))
    assert group([a, b])["n2"] == ("n1", 2)
