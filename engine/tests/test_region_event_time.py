"""사건 시간대 확인(answer_summary.event_period): 달 · 연도 보정. 모델은 부르지 않는다."""

from datetime import date, timedelta

import pytest

from pipeline.region import answer_summary
from pipeline.region.answer_summary import event_period

DEC1 = "2025-12-01T00:00:00.000+09:00"


def period(start, basis, published=DEC1, end=""):
    return event_period({"start": start, "end": end, "basis": basis}, published)


@pytest.mark.parametrize(
    ("start", "basis", "want"),
    [
        ("2025-12-30", "30일", "2025-11-30"),  # 검수 v3 47번: 12/1 기사의 「30일」
        ("2025-12-28", "28일 오후", "2025-11-28"),  # 42번
        ("2025-12-28", "지난 28일", "2025-11-28"),  # 「지난」은 발행일 이전
        ("2026-01-28", "28일", "2025-11-28"),  # 다음 달로 넘어간 것도
    ],
)
def test_bare_day_far_from_published_moves_to_nearest_month(start, basis, want):
    t0, t1, unit, note = period(start, basis)
    assert (t0[:10], unit) == (want, "day")
    # 하루 일이라 끝(미포함)은 다음 날
    assert date.fromisoformat(t1[:10]) == date.fromisoformat(want) + timedelta(days=1)
    assert note["달_고침"] == f"{start} → {want}"


@pytest.mark.parametrize(
    ("start", "basis"),
    [
        ("2025-12-04", "오는 4일"),  # 검수 v3 6번: 미래 표시 · 가까움
        ("2025-12-28", "오는 28일"),  # 미래 표시 → 발행일 이후에서만, 12/28 이 가장 가깝다
        ("2025-12-30", "12월 30일"),  # 달이 적혀 있다
        ("2025-12-30", "다음 달 30일"),
        ("2025-12-30", "내년 30일"),  # 연도 표현
        ("2025-12-30", "연말"),  # 날짜 숫자 없음
        ("2025-12-10", "10일"),  # 15일 안 — LLM 이 고른 달 그대로
    ],
)
def test_month_is_kept_when_text_says_so_or_close(start, basis):
    t0, _, _, note = period(start, basis)
    assert t0.startswith(start) and "달_고침" not in note


def test_period_moves_with_start():
    t0, t1, unit, note = period("2025-12-29", "29~30일", end="2025-12-30")
    assert (t0[:10], t1[:10], unit) == ("2025-11-29", "2025-12-01", "day")  # 끝은 미포함 경계
    assert "날짜_근거_불일치" not in note


def test_minute_keeps_time_of_day():
    t0, t1, unit, note = period("2025-12-30 21:20", "30일 오후 9시 20분께")
    assert (t0, t1, unit) == ("2025-11-30T21:20:00+09:00", None, "minute")


def test_day_31_skips_months_without_it():
    # 3월 2일 기사의 「31일」: 후보 2월 31일 · 4월 31일은 없는 날이라 건너뛰고, 3월 31일보다 가까운 후보가 없어 그대로
    t0, _, _, note = period("2025-03-31", "31일", published="2025-03-02T00:00:00.000+09:00")
    assert t0.startswith("2025-03-31") and "달_고침" not in note


def test_version_is_bumped():
    assert answer_summary.SUMMARY_VERSION == "s1.2"
