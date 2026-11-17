"""journey.sh 결과 폴더를 마크다운 표로 만든다(S15P31C108-340). 표준 라이브러리만 쓴다.

    python backend/loadtest/journey_report.py <결과 폴더> [--statements 12]

표: API 별 전체 · 동시 사용자 단계별 · 질문 실행 서버 시간(판정 · 저장 vs 문장화) · 풀 · DB 연결 · CPU · DB 쿼리 상위.
"""

import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

APIS = ["places", "cards", "question", "argument", "boundaries", "observations", "evidence", "csrf"]


def pct(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def ms(v):
    if v is None:
        return "-"
    return f"{v / 1000:.2f} s" if v >= 1000 else f"{v:.0f} ms"


def load_k6(folder):
    reqs, vus = [], {}
    with open(folder / "k6.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row["metric_name"]
            if name == "vus":
                vus[int(row["timestamp"])] = int(float(row["metric_value"]))
            elif name == "http_req_duration":
                api = re.search(r"api=(\w+)", row.get("extra_tags") or "")
                api = api.group(1) if api else (row.get("api") or "")
                if not api:
                    continue
                ok = row["status"].startswith(("2", "3"))
                reqs.append((int(row["timestamp"]), api, float(row["metric_value"]), ok))
    return reqs, vus


def vu_at(vus, ts):
    """그 초의 VU 수(가장 가까운 앞 표본)"""
    for t in range(ts, ts - 10, -1):
        if t in vus:
            return vus[t]
    return 0


def level(v, levels):
    """VU 수 → 머무르기 단계(가장 가까운 아래 단계). 오르는 중의 요청도 아래 단계에 넣는다"""
    out = levels[0]
    for lv in levels:
        if v >= lv:
            out = lv
    return out


def overall(reqs):
    t0, t1 = min(r[0] for r in reqs), max(r[0] for r in reqs)
    secs = max(t1 - t0, 1)
    print("| API | 요청 | 오류율 | 처리량(건/s) | p50 | p95 | p99 | 최대 |")
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    by = defaultdict(list)
    for r in reqs:
        by[r[1]].append(r)
    for api in APIS:
        rows = by.get(api)
        if not rows:
            continue
        d = [r[2] for r in rows]
        err = sum(1 for r in rows if not r[3]) / len(rows)
        print(
            f"| {api} | {len(rows)} | {err:.1%} | {len(rows) / secs:.2f} | {ms(pct(d, 50))} | {ms(pct(d, 95))} |"
            f" {ms(pct(d, 99))} | {ms(max(d))} |"
        )
    total = len(reqs)
    err = sum(1 for r in reqs if not r[3]) / total
    print(f"| **전체** | {total} | {err:.1%} | {total / secs:.2f} | | | | |")
    print(f"\n시험 시간 {secs} 초.\n")


def by_level(reqs, vus, levels, extra):
    print(
        "| 동시 사용자 | 질문 건/분 | 질문 p50 | 질문 p95 | 질문 p99 | 결과 p95 | 근거 상세 p95 | 시공간 점 p95 |"
        " 경계 p95 | 오류율 | 풀 대기 최대 | DB active 최대 | backend CPU 평균 | DB CPU 평균 |"
    )
    print("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    groups = defaultdict(list)
    for r in reqs:
        groups[level(vu_at(vus, r[0]), levels)].append(r)
    for lv in levels:
        rows = groups.get(lv)
        if not rows:
            continue
        span = max(max(r[0] for r in rows) - min(r[0] for r in rows), 1)
        get = lambda api: [r[2] for r in rows if r[1] == api]  # noqa: E731
        q = get("question")
        err = sum(1 for r in rows if not r[3]) / len(rows)
        secs = {r[0] for r in rows}
        pool = [w for ts, w in extra["pool"] if int(ts) in secs]
        pg = [a for ts, a in extra["pg"] if ts in secs]
        app = [c for ts, n, c in extra["cpu"] if n == "app" and any(abs(ts - s) <= 1 for s in (ts,)) and ts in secs]
        db = [c for ts, n, c in extra["cpu"] if n == "db" and ts in secs]
        avg = lambda xs: f"{sum(xs) / len(xs):.0f}%" if xs else "-"  # noqa: E731
        print(
            f"| {lv} | {len(q) / span * 60:.0f} | {ms(pct(q, 50))} | {ms(pct(q, 95))} | {ms(pct(q, 99))} |"
            f" {ms(pct(get('argument'), 95))} | {ms(pct(get('evidence'), 95))} | {ms(pct(get('observations'), 95))} |"
            f" {ms(pct(get('boundaries'), 95))} | {err:.1%} | {max(pool) if pool else '-'} | {max(pg) if pg else '-'} |"
            f" {avg(app)} | {avg(db)} |"
        )
    print()


def extras(folder):
    pool = []
    pat = re.compile(r"^(\S+) .*active=(\d+), waiting=(\d+)")
    path = folder / "pool.log"
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            m = pat.search(line)
            if m:
                try:
                    pool.append((datetime.fromisoformat(m.group(1)).timestamp(), int(m.group(3))))
                except ValueError:
                    pass
    pg = []
    with open(folder / "pg.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["ts"].isdigit():
                pg.append((int(row["ts"]), int(row["active"])))
    cpu = []
    path = folder / "stats.csv"
    if path.exists():
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                try:
                    name = "app" if row["name"].endswith("app") else "db"
                    for d in (0, 1):  # 2초 표본을 두 초에 걸쳐 쓴다
                        cpu.append((int(row["ts"]) + d, name, float(row["cpu"].rstrip("%"))))
                except (ValueError, KeyError, AttributeError):
                    pass
    return {"pool": pool, "pg": pg, "cpu": cpu}


def runs(folder):
    path = folder / "runs.csv"
    if not path.exists():
        return
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
    if not rows:
        return
    print("| 카드 | 실행 | 전체 p50 | 전체 p95 | 문장화 p50 | 서버(전체 − 문장화) p50 | p95 | p99 | 근거 행 평균 |")
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    by = defaultdict(list)
    for r in rows:
        by[r["card_id"]].append(r)
    for card, rs in sorted(by.items()):
        total = [int(r["duration_ms"]) for r in rs]
        phr = [int(r["phrasing_ms"] or 0) for r in rs]
        server = [t - p for t, p in zip(total, phr)]
        src = [int(r["sources"]) for r in rs]
        print(
            f"| {card} | {len(rs)} | {ms(pct(total, 50))} | {ms(pct(total, 95))} | {ms(pct(phr, 50))} |"
            f" {ms(pct(server, 50))} | {ms(pct(server, 95))} | {ms(pct(server, 99))} | {sum(src) / len(src):.0f} |"
        )
    print()


def statements(folder, n):
    path = folder / "statements.csv"
    if not path.exists():
        return
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
    total = sum(float(r["total_ms"]) for r in rows) or 1
    print("| 순위 | 호출 | 총 시간 | 비중 | 평균 | 최대 | 쿼리(앞부분) |")
    print("| ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for i, r in enumerate(rows[:n], 1):
        q = r["query"].replace("|", "\\|")[:140]
        print(
            f"| {i} | {r['calls']} | {float(r['total_ms']) / 1000:.1f} s | {float(r['total_ms']) / total:.0%} |"
            f" {float(r['mean_ms']):.1f} ms | {float(r['max_ms']):.0f} ms | `{q}` |"
        )
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--levels", default="1,10,25,50,100")
    ap.add_argument("--statements", type=int, default=12)
    args = ap.parse_args()
    folder = Path(args.folder)
    reqs, vus = load_k6(folder)
    levels = [int(x) for x in args.levels.split(",")]
    print(f"### {folder.name}\n")
    overall(reqs)
    by_level(reqs, vus, levels, extras(folder))
    runs(folder)
    statements(folder, args.statements)
    engine = folder / "engine.json"
    if engine.exists() and engine.read_text().strip():
        print(f"가짜 engine: {json.loads(engine.read_text())}\n")


if __name__ == "__main__":
    main()
