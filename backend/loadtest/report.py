"""run.sh 결과 폴더 여러 개를 표(마크다운)와 SVG 그래프로 만든다. 표준 라이브러리만 쓴다.

    python backend/loadtest/report.py --svg <파일.svg> "고치기 전=<폴더>" "고친 뒤=<폴더>"

그래프는 세로로 세 칸, 칸마다 y축 하나:
조회 API p95 응답 시간(5초 묶음) · 커넥션 풀 대기 스레드 · 누적 완료 질문.
"""

import argparse
import csv
import json
import math
import re
from datetime import datetime
from pathlib import Path

# 기본 팔레트 1 · 2번(파랑 · 주황). 고친 뒤가 파랑
COLORS = ["#eb6834", "#2a78d6", "#1baf7a"]
BUCKET = 5
MUTED = 'fill="#52514e"'
INK = 'fill="#0b0b0b"'
GRID = 'stroke="#e8e7e3"'


def pct(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def load(folder):
    folder = Path(folder)
    reqs = []
    with open(folder / "k6.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["metric_name"] != "http_req_duration":
                continue
            api = re.search(r"api=(\w+)", row.get("extra_tags") or "")
            if not api:
                continue
            reqs.append(
                (int(row["timestamp"]), api.group(1), float(row["metric_value"]), row["status"])
            )
    t0 = min(r[0] for r in reqs)
    pool = []
    pattern = re.compile(r"^(\S+) .*active=(\d+), waiting=(\d+)")
    for line in (folder / "pool.log").read_text(encoding="utf-8").splitlines():
        m = pattern.search(line)
        if m:
            ts = datetime.fromisoformat(m.group(1)).timestamp()
            pool.append((ts, int(m.group(2)), int(m.group(3))))
    pg = []
    with open(folder / "pg.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row["ts"].isdigit():  # docker exec 가 가끔 내는 오류 줄
                continue
            pg.append((int(row["ts"]), int(row["active"]), int(row["idle_in_tx"])))
    engine = json.loads((folder / "engine.json").read_text(encoding="utf-8"))
    summary = json.loads((folder / "summary.json").read_text(encoding="utf-8"))
    return {"reqs": reqs, "t0": t0, "pool": pool, "pg": pg, "engine": engine, "summary": summary}


def stats(run):
    q = [r for r in run["reqs"] if r[1] == "question"]
    p = [r for r in run["reqs"] if r[1] == "probe"]
    q_ok = [r[2] for r in q if r[3] == "201"]
    p_ok = [r[2] for r in p if r[3] == "200"]
    span = max(r[0] for r in run["reqs"]) - run["t0"] or 1
    window = [w for w in run["pool"] if run["t0"] <= w[0] <= run["t0"] + span]
    pg = [w for w in run["pg"] if run["t0"] <= w[0] <= run["t0"] + span]
    return {
        "질문 성공": f"{len(q_ok)} / {len(q)}",
        "질문 처리량(건/분)": f"{len(q_ok) / span * 60:.1f}",
        "질문 p50 · p95(초)": f"{pct(q_ok, 50) / 1000:.1f} · {pct(q_ok, 95) / 1000:.1f}"
        if q_ok
        else "-",
        "조회 성공": f"{len(p_ok)} / {len(p)}",
        "조회 p50 · p95(ms)": f"{pct(p_ok, 50):.0f} · {pct(p_ok, 95):.0f}" if p_ok else "-",
        "조회 최대(ms)": f"{max(r[2] for r in p):.0f}" if p else "-",
        "풀 사용 최대(10개 중)": str(max((w[1] for w in window), default=0)),
        "풀 대기 스레드 최대": str(max((w[2] for w in window), default=0)),
        "트랜잭션 안에서 놀던 연결 최대": str(max((w[2] for w in pg), default=0)),
        "engine 호출": str(run["engine"].get("calls")),
    }


def table(runs):
    names = list(runs)
    rows = {name: stats(run) for name, run in runs.items()}
    keys = list(next(iter(rows.values())))
    lines = ["| 항목 | " + " | ".join(names) + " |", "| --- |" + " ---: |" * len(names)]
    lines += ["| " + k + " | " + " | ".join(rows[n][k] for n in names) + " |" for k in keys]
    return "\n".join(lines)


def series(run):
    t0 = run["t0"]
    buckets = {}
    for ts, api, ms, _ in run["reqs"]:
        if api == "probe":
            buckets.setdefault((ts - t0) // BUCKET * BUCKET, []).append(ms / 1000)
    probe = sorted((t + BUCKET / 2, pct(v, 95)) for t, v in buckets.items())
    waiting = [(ts - t0, w) for ts, _, w in run["pool"] if 0 <= ts - t0 <= 160]
    done = sorted(
        ts - t0 for ts, api, _, status in run["reqs"] if api == "question" and status == "201"
    )
    cumulative = [(0, 0)] + [(t, i + 1) for i, t in enumerate(done)]
    return probe, waiting, cumulative


def svg(runs, path, title):
    width, panel_h, left, right, top = 760, 170, 64, 24, 64
    gap = 54
    height = top + 3 * panel_h + 2 * gap + 40
    x_max = max(max(r[0] for r in run["reqs"]) - run["t0"] for run in runs.values())
    x_max = (int(x_max) // 30 + 1) * 30
    plot_w = width - left - right
    panels = [
        ("조회 API(GET /v1/places) p95 응답 시간 · 초", 0),
        ("커넥션 풀 대기 스레드 · 개", 1),
        ("누적 완료 질문 · 건", 2),
    ]
    data = {name: series(run) for name, run in runs.items()}
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="system-ui, -apple-system, \'Segoe UI\', sans-serif" font-size="12">',
        f'<rect width="{width}" height="{height}" fill="#fcfcfb"/>',
        f'<text x="{left}" y="26" font-size="16" font-weight="600" {INK}>{title}</text>',
    ]
    # 범례
    lx = left
    for i, name in enumerate(runs):
        out.append(
            f'<line x1="{lx}" y1="44" x2="{lx + 18}" y2="44"'
            f' stroke="{COLORS[i]}" stroke-width="2"/>'
        )
        out.append(f'<text x="{lx + 24}" y="48" fill="#52514e">{name}</text>')
        lx += 24 + 14 * len(name) + 28
    for title, idx in panels:
        y0 = top + idx * (panel_h + gap) + 20
        y1 = y0 + panel_h
        y_max = max((v for d in data.values() for _, v in d[idx]), default=1) or 1
        step = nice_step(y_max)
        y_max = (int(y_max / step) + 1) * step
        out.append(
            f'<text x="{left}" y="{y0 - 10}" font-weight="600" fill="#0b0b0b">{title}</text>'
        )
        for k in range(int(y_max / step) + 1):
            v = k * step
            y = y1 - v / y_max * panel_h
            out.append(f'<line x1="{left}" y1="{y:.1f}" x2="{width - right}" y2="{y:.1f}" {GRID}/>')
            label = number(v)
            out.append(
                f'<text x="{left - 8}" y="{y + 4:.1f}" text-anchor="end" {MUTED}>{label}</text>'
            )
        for t in range(0, x_max + 1, 30):
            x = left + t / x_max * plot_w
            out.append(f'<text x="{x:.1f}" y="{y1 + 16}" text-anchor="middle" {MUTED}>{t}초</text>')
        labels = []
        for i, d in enumerate(data.values()):
            points = " ".join(
                f"{left + t / x_max * plot_w:.1f},{y1 - v / y_max * panel_h:.1f}" for t, v in d[idx]
            )
            shape = ' stroke-linejoin="round"' if idx != 2 else ""
            out.append(
                f'<polyline points="{points}" fill="none" stroke="{COLORS[i]}"'
                f' stroke-width="2"{shape}/>'
            )
            if d[idx]:
                t, v = d[idx][-1] if idx == 2 else max(d[idx], key=lambda p: p[1])
                x = left + t / x_max * plot_w
                y = y1 - v / y_max * panel_h - 6
                # 앞 선의 라벨과 겹치면 아래로 비킨다
                while any(abs(x - lx) < 60 and abs(y - ly) < 14 for lx, ly in labels):
                    y += 14
                labels.append((x, y))
                anchor = "end" if x > width - 120 else "start"
                out.append(
                    f'<text x="{min(x + 6, width - right - 4):.1f}" y="{y:.1f}" '
                    f'text-anchor="{anchor}" {INK}>{number(v)}</text>'
                )
    out.append("</svg>")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(out), encoding="utf-8")


def nice_step(v):
    """눈금이 5칸 안팎이 되는 1 · 2 · 5 × 10^k."""
    base = 10 ** math.floor(math.log10(v / 5))
    for m in (1, 2, 5, 10):
        if v / (m * base) <= 5:
            return m * base
    return 10 * base


def number(v):
    return f"{v:,.0f}" if v >= 100 else f"{v:.3g}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--svg")
    parser.add_argument("--title", default="동시 질문 30명 · 문장화 13초 · 2분")
    parser.add_argument("runs", nargs="+", help="이름=폴더")
    args = parser.parse_args()
    runs = {r.split("=", 1)[0]: load(r.split("=", 1)[1]) for r in args.runs}
    print(table(runs))
    if args.svg:
        svg(runs, args.svg, args.title)
