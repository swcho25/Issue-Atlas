"""news_event 행을 적재 전에 고치고 검사한다. 본문을 지워도 되는 요약인지도 여기서 정한다.

행은 news_event 칸 이름의 dict(news_id · summary · event_start · event_end · time_precision ·
place_name · address · lon · lat · location_precision · place_id · sido · sigun · gu · regions).
시각은 ISO 8601 문자열.

고치기 (fix_row, p3-region-lab p3_fix v2 · 2026-11-02 결정)
  1) 사건 시작이 분석 기간(2023-01-01 ~ 2027-01-01) 밖이면 발행일 0시 · published · 끝 없음
  2) time_precision = day 인데 기간이 31일을 넘으면 month
지역 칸은 LLM 판정 그대로 둔다 — 장소 위치로 광주 구를 좁히면 틀리는 일이 많았다
(p7 실험: 좁힌 6건 중 3건 오답).
"""

from datetime import datetime, timedelta, timezone

from .labels import SIDO_VALUES

KST = timezone(timedelta(hours=9))
WINDOW = (datetime(2023, 1, 1, tzinfo=KST), datetime(2027, 1, 1, tzinfo=KST))
TIME_PRECISIONS = frozenset({"minute", "day", "month", "published"})
LOCATION_PRECISIONS = frozenset({"address", "admin_centroid", "none"})
# place_id: 시도 kr-<2> · 시군구 kr-<5> · 행정동 kr-<8> · 법정동 kr-<10> (V0018 · V0019 · V0024)
PLACE_ID_DIGITS = frozenset({2, 5, 8, 10})
# 본문을 지워도 되는 요약 (기사 계약 v0.3 「본문 지우기」, P2 박준우 2026-11-02)
SUMMARY_LENGTH = (20, 300)
COPIED_PREFIX = 60  # 요약 앞 이만큼이 본문에 그대로 있으면 본문을 옮긴 것


def parse_time(value: str) -> datetime:
    t = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return t if t.tzinfo else t.replace(tzinfo=KST)


def fix_row(row: dict, published_at: str | None) -> list[str]:
    """규칙 1 · 2 를 row 에 바로 적용하고 고친 내용을 돌려준다"""
    notes = []
    start = parse_time(row["event_start"]) if row.get("event_start") else None
    if start and not WINDOW[0] <= start < WINDOW[1]:
        if published_at:
            day = parse_time(published_at).astimezone(KST)
            row["event_start"] = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            row["event_end"], row["time_precision"] = None, "published"
            notes.append("out_of_window→published")
        else:
            notes.append("out_of_window(발행 시각 없음)")
    if row.get("time_precision") == "day" and row.get("event_end"):
        if (parse_time(row["event_end"]) - parse_time(row["event_start"])).days > 31:
            row["time_precision"] = "month"
            notes.append("day→month")
    return notes


def violations(row: dict) -> list[str]:
    """적재하면 안 되는 이유. 빈 목록이면 적재해도 된다 (news_event CHECK 와 contracts/p3 규칙)"""
    v = [f"{k} 없음" for k in ("news_id", "event_start", "time_precision", "sido",
                                "location_precision") if not row.get(k)]  # fmt: skip
    if row.get("time_precision") not in TIME_PRECISIONS:
        v.append(f"time_precision={row.get('time_precision')}")
    if row.get("location_precision") not in LOCATION_PRECISIONS:
        v.append(f"location_precision={row.get('location_precision')}")
    if row.get("sido") and row["sido"] not in SIDO_VALUES:
        v.append(f"sido={row['sido']}")
    start, end = row.get("event_start"), row.get("event_end")
    if start and end and parse_time(end) <= parse_time(start):
        v.append("event_end<=event_start")
    if row.get("time_precision") == "published" and end:
        v.append("published인데 event_end 있음")
    has_xy = row.get("lon") not in (None, "") and row.get("lat") not in (None, "")
    if has_xy != (row.get("location_precision") != "none"):
        v.append("좌표와 location_precision 불일치")
    if has_xy and not (124 <= float(row["lon"]) <= 132 and 33 <= float(row["lat"]) <= 39):
        v.append("좌표가 한국 범위 밖")
    pid = row.get("place_id")
    if pid and not (
        pid.startswith("kr-") and pid[3:].isdigit() and len(pid) - 3 in PLACE_ID_DIGITS
    ):
        v.append(f"place_id 형식={pid}")
    v += _region_violations(row)
    return v


def _region_violations(row: dict) -> list[str]:
    """regions: 비지 않은 배열, 원소의 시도는 정한 값, 첫 원소 = 대표 지역 칸 (contracts/p3 v0.4)"""
    regions = row.get("regions")
    if not isinstance(regions, list) or not regions:
        return ["regions 없음"]
    v = [f"regions 시도={r.get('sido')}" for r in regions if r.get("sido") not in SIDO_VALUES]
    first = regions[0]
    if (first.get("sido"), first.get("sigun"), first.get("gu")) != (
        row.get("sido"),
        row.get("sigun") or None,
        row.get("gu") or None,
    ):
        v.append("regions 첫 원소 ≠ 대표 지역")
    return v


def good_summary(summary: str | None, body: str | None) -> bool:
    """본문을 지워도 되는 요약: 있음 · 20~300자 · 앞 60자가 본문에 그대로 있지 않음.
    서버에서 지울 기사를 고르는 SQL(btrim · left · position)과 같은 판정이다"""
    text = (summary or "").strip(" ")
    if not SUMMARY_LENGTH[0] <= len(text) <= SUMMARY_LENGTH[1]:
        return False
    return not body or text[:COPIED_PREFIX] not in body
