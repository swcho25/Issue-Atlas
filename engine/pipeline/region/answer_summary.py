"""기사 요약 · 사건 시간대 질문(s1)과 답 확인.
p3-region-lab region_lab/models/summary.py 에서 옮겼다.

지역 질문과 따로 묻는다 — 지역 정확도를 잰 프롬프트를 건드리지 않으려고.
- 요약: 한두 문장 120자 안팎. 본문 문장을 옮기지 않는다(본문은 요약 뒤 지운다, 기사 계약 v0.3)
- 시간대: 그 일이 일어난(일어날) 때. 「지난 28일 · 오는 3일」은 LLM 이 발행일 기준으로
  날짜로 바꾸고,
  여기서 형식 · 근거를 확인한다. 날짜가 없으면 발행 시각(published, 끝 없음)
s1.1 (2026-11-02): 프롬프트는 s1 그대로. 요약 앞 60자가 본문에 그대로 있으면(checks.good_summary 가
본문을 지우지 않는 요약) 「새로 쓰라」 덧붙임을 달아 한 번 더 묻는다 —
s1 서버 기사 3,478건 중 47건이 본문을 옮겼다.
s1.2 (2026-11-04): 프롬프트는 s1 그대로. 글에 달 없이 「N일」만 있는데 발행일과 15일 넘게
떨어진 날짜를 발행일에 가장 가까운 그 날로 옮긴다(nearest_month) — 검수 v3(dev 120건)에서
12월 1일 기사의 「30일」을 12월 30일로 잡은 것 3건(실제 11월 30일).
"""

import re
from datetime import date, datetime, timedelta

from .checks import COPIED_PREFIX, KST
from .llm import parse_json
from .text import body_text

SUMMARY_VERSION = "s1.2"
MAX_TOKENS = 400
BODY_CHARS = 2000
_WEEKDAY = "월화수목금토일"

SYSTEM = """너는 한국 지역 뉴스에서 「무슨 일이 언제 있었나」를 뽑는 도우미다.

summary: 글이 다루는 일을 한두 문장, 120자 안팎으로. 누가 · 어디서 · 무엇을 했는지(할 것인지) 사실만 쓴다.
   본문 문장을 그대로 옮기지 말고 새로 쓴다. 기자 · 매체 이름, 사진 설명, 따옴표 인용은 넣지 않는다. 평가 · 전망을 덧붙이지 않는다.
   광고 · 분양 글이면 무엇을 알리는 글인지만 쓴다. 문장은 「~했다 · ~한다」로 끝낸다.
event: 그 일이 실제로 일어난(일어날) 때. 기사가 나온 때가 아니다.
   - start · end: "YYYY-MM-DD", 시각이 적혀 있으면 "YYYY-MM-DD HH:MM"(24시간), 달만 있으면 "YYYY-MM". 하루 일이면 end 는 "".
   - 행사 · 공사 · 접수 · 전시처럼 기간이 있으면 start 와 end 를 모두 쓴다.
   - 「어제 · 지난 28일 · 오는 3일 · 다음 달」은 발행일을 기준으로 날짜를 계산한다. 연도가 없으면 발행일에 가장 가까운 해.
   - 날짜가 적히지 않은 발표 · 회의 · 협약이나, 날짜 없는 칼럼 · 운세 · 일반 정보는 start · end 모두 "".
   - basis: 날짜를 정한 글의 시간 표현을 그대로 (예: "지난 28일 오후 3시께", "다음 달 1일부터 5일까지"). 없으면 "".

답은 JSON 한 개만: {"summary": "...", "event": {"start": "...", "end": "...", "basis": "..."}}

예시
- 발행일 2026-10-15(목) 「여수산단 공장서 불…1명 부상」 본문 「14일 오후 9시 20분께 여수시 화치동의 한 화학공장에서…」
  → {"summary": "여수국가산단의 한 화학공장에서 불이 나 작업자 1명이 다쳤다.", "event": {"start": "2026-10-14 21:20", "end": "", "basis": "14일 오후 9시 20분께"}}
- 발행일 2026-10-02(금) 「순천만국가정원 가을꽃 축제」 본문 「오는 10일부터 19일까지 순천만국가정원에서…」
  → {"summary": "순천시가 순천만국가정원에서 가을꽃 축제를 연다.", "event": {"start": "2026-10-10", "end": "2026-10-19", "basis": "오는 10일부터 19일까지"}}
- 발행일 2026-10-20(화) 「광주시, 청년 월세 지원 확대」 본문에 날짜 없음
  → {"summary": "광주시가 청년 월세 지원 대상을 넓힌다.", "event": {"start": "", "end": "", "basis": ""}}"""  # noqa: E501 — 잰 프롬프트를 글자 그대로 둔다

JSON_HINT = "\n\n(답은 JSON 한 개만. summary 는 두 문장 이내로 짧게)"
REWRITE_HINT = "\n\n(summary 는 본문 문장을 한 글자도 그대로 쓰지 말고 네 말로 새로 쓴다)"

_DT = re.compile(r"(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$")
_MONTH = re.compile(r"(\d{4})-(\d{2})$")
_DAY_IN_BASIS = re.compile(r"(\d{1,2})\s?(?=일|[~～-]\s?\d{1,2}\s?일)")  # 「28일」 · 「15~17일」
_YEAR_WORD = re.compile(r"\d{2,4}\s?년|지난해|작년|내년|이듬해|올해|전년|연초|연말")
_PAST = re.compile(r"지난|어제|그제|전날|앞서")
_AHEAD = re.compile(r"오는|다음|내달|내일|모레|예정")
_MONTH_WORD = re.compile(
    r"\d{1,2}\s?월|지난\s?달|이번\s?달|이달|다음\s?달|내달|전달|전월|익월|월초|월말"
)
MONTH_GAP = 15  # 이보다 가까우면 LLM 이 고른 달을 그대로 둔다


def published_day(published_at: str) -> date:
    """빅카인즈 발행 시각('2026-10-01T00:00:00.000+09:00') → 한국 날짜"""
    return datetime.fromisoformat(published_at).astimezone(KST).date()


def user_message(article: dict) -> str:
    pub = published_day(article["published_at"])
    body = body_text(article.get("title", ""), article.get("lead", ""))
    return (
        f"발행일: {pub.isoformat()} ({_WEEKDAY[pub.weekday()]})\n"
        f"제목: {article.get('title', '')}\n본문: {body[:BODY_CHARS]}"
    )


def _parse_point(s: str) -> tuple[datetime, str] | None:
    """'2026-10-14 21:20' · '2026-10-14' · '2026-10' → (KST 시각, 단위)"""
    s = str(s or "").strip()
    try:
        if m := _DT.match(s):
            y, mo, d, hh, mm = m.groups()
            if hh is not None:
                return datetime(int(y), int(mo), int(d), int(hh), int(mm), tzinfo=KST), "minute"
            return datetime(int(y), int(mo), int(d), tzinfo=KST), "day"
        if m := _MONTH.match(s):
            return datetime(int(m.group(1)), int(m.group(2)), 1, tzinfo=KST), "month"
    except ValueError:  # 2026-02-30 같은 없는 날짜
        return None
    return None


def _after(t: datetime, unit: str) -> datetime:
    """그 단위가 끝나는 때 (끝 미포함 경계)"""
    if unit == "day":
        return t + timedelta(days=1)
    if unit == "month":
        return t.replace(year=t.year + t.month // 12, month=t.month % 12 + 1)
    return t + timedelta(minutes=1)


def nearest_year(t0: datetime, t1: datetime | None, basis: str, pub: date):
    """글에 연도가 없는데 발행일과 200일 넘게 떨어진 날짜 → 발행일에 가장 가까운 해로 옮긴다.
    「지난 ○일」은 발행일 이전, 「오는 · 다음」은 이후에서만 고른다 (s1 연도 실수 5건)"""
    if _YEAR_WORD.search(basis) or abs((t0.date() - pub).days) <= 200:
        return t0, t1, 0
    past, ahead = _PAST.search(basis), _AHEAD.search(basis)
    best, best_gap = 0, abs((t0.date() - pub).days)
    for year in (pub.year - 1, pub.year, pub.year + 1):
        try:
            c = t0.replace(year=year)
        except ValueError:  # 2월 29일
            continue
        if (past and c.date() > pub) or (ahead and c.date() < pub):
            continue
        if (gap := abs((c.date() - pub).days)) < best_gap:
            best, best_gap = year - t0.year, gap
    if not best:
        return t0, t1, 0
    return t0.replace(year=t0.year + best), t1.replace(year=t1.year + best) if t1 else None, best


def nearest_month(t0: datetime, t1: datetime | None, basis: str, pub: date):
    """글에 달 · 연도 없이 「N일」만 있는데 발행일과 MONTH_GAP 일 넘게 떨어진 날짜 →
    발행 달 앞뒤의 그 날 중 발행일에 가장 가까운 날로 옮긴다.
    「지난」은 발행일 이전, 「오는 · 다음」은 이후에서만 고른다.
    예: 발행 12월 1일 「30일」 → 11월 30일 (s1 이 12월 30일로 잡은 것, 검수 v3 3건)"""
    days = {int(d) for d in _DAY_IN_BASIS.findall(basis)}
    gap = abs((t0.date() - pub).days)
    if (
        t0.day not in days
        or _MONTH_WORD.search(basis)
        or _YEAR_WORD.search(basis)
        or gap <= MONTH_GAP
    ):
        return t0, t1, None
    past, ahead = _PAST.search(basis), _AHEAD.search(basis)
    best = None
    for k in (-1, 0, 1):
        y, m = divmod(pub.year * 12 + pub.month - 1 + k, 12)
        try:
            c = t0.replace(year=y, month=m + 1)
        except ValueError:  # 31일이 없는 달
            continue
        if (past and c.date() > pub) or (ahead and c.date() < pub):
            continue
        if (g := abs((c.date() - pub).days)) < gap:
            best, gap = c, g
    if best is None:
        return t0, t1, None
    moved = best - t0
    return best, t1 + moved if t1 else None, moved


def event_period(event: dict, published_at: str) -> tuple[str, str | None, str, dict]:
    """LLM 의 event → (시작, 끝(미포함) 또는 None, 정밀도, 확인 메모).
    날짜가 없거나 형식이 틀리면 발행 시각 하나(끝 없음)"""
    pub = published_day(published_at)
    note: dict = {}
    start = _parse_point(event.get("start", ""))
    if start is None:
        if str(event.get("start", "")).strip():
            note["시간_형식오류"] = event.get("start")
        return (
            datetime.fromisoformat(published_at).astimezone(KST).isoformat(),
            None,
            "published",
            note,
        )
    t0, unit = start
    end = _parse_point(event.get("end", ""))
    if end and end[0] < t0:
        note["끝이_시작보다_앞"] = event.get("end")
        end = None
    if end:
        t1 = _after(*end) if end[1] != "minute" else end[0]
    else:
        t1 = None if unit == "minute" else _after(t0, unit)
    if t1 is not None and t1 <= t0:  # 「오후 3시~3시」처럼 끝이 시작과 같은 시각
        t1 = None if unit == "minute" else _after(t0, unit)
    basis = str(event.get("basis", ""))
    t0, t1, shift = nearest_year(t0, t1, basis, pub)
    if shift:
        note["연도_고침"] = f"{event.get('start')} → {t0.date().isoformat()}"
    t0, t1, moved = nearest_month(t0, t1, basis, pub)
    if moved:
        note["달_고침"] = f"{event.get('start')} → {t0.date().isoformat()}"
    if abs((t0.date() - pub).days) > 3 * 366:
        note["발행일과_3년_넘게_떨어짐"] = t0.date().isoformat()
    days = {int(d) for d in _DAY_IN_BASIS.findall(basis)}
    last = (t1 - timedelta(days=1)).day if t1 and unit == "day" else t0.day
    if unit != "month" and days and not days & {t0.day, last}:
        note["날짜_근거_불일치"] = basis  # 「지난 28일」인데 시작 · 끝날이 28일이 아님
    return t0.isoformat(), t1.isoformat() if t1 else None, unit, note


def parse(raw: str, published_at: str) -> dict | None:
    out = parse_json(raw)
    if out is None:
        return None
    summary = re.sub(r"\s+", " ", str(out.get("summary") or "")).strip()
    event = out.get("event") if isinstance(out.get("event"), dict) else {}
    start, end, precision, notes = event_period(event, published_at)
    if not summary:
        notes["요약_없음"] = True
    return {"summary": summary, "event_start": start, "event_end": end, "time_precision": precision,
            "time_basis": str(event.get("basis") or "").strip(), "notes": notes}  # fmt: skip


def answer(article: dict, ask, first: str | None = None) -> dict:
    """기사 하나 → {summary, event_start, event_end, time_precision, time_basis, notes}.
    JSON 이 아니면 한 번 더, 요약이 본문을 옮겼으면 한 번 더 묻는다.
    그래도 안 되면 요약 없이 발행 시각"""
    user = user_message(article)
    raw = first if first is not None else ask(SYSTEM, user, MAX_TOKENS)
    out = parse(raw, article["published_at"])
    if out is None:
        out = parse(ask(SYSTEM, user + JSON_HINT, MAX_TOKENS), article["published_at"])
    if out is None:
        start, end, precision, _ = event_period({}, article["published_at"])
        return {"summary": "", "event_start": start, "event_end": end, "time_precision": precision,
                "time_basis": "", "notes": {"오류": "JSON 아님"}}  # fmt: skip
    body = article.get("lead", "")
    if _copied(out["summary"], body):
        again = parse(ask(SYSTEM, user + REWRITE_HINT, MAX_TOKENS), article["published_at"])
        if again and again["summary"] and not _copied(again["summary"], body):
            again["notes"]["요약_다시씀"] = True
            return again
        out["notes"]["요약_본문옮김"] = True  # 남긴다 — 적재는 하되 본문 지우기에서 빠진다
    return out


def _copied(summary: str, body: str) -> bool:
    """요약 앞부분이 본문에 그대로 있다 (checks.good_summary 와 같은 기준)"""
    text = summary.strip(" ")
    return bool(text and body) and text[:COPIED_PREFIX] in body
