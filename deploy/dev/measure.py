"""데모 흐름 API 응답 시간(S15P31C108-178).

어디서나 실행: python deploy/dev/measure.py [--base-url ...]

브라우저처럼 연결 하나를 다시 쓰고(gzip 요청), API 마다 --runs 번 재서 중앙값 · p95 를 낸다.
`/actuator/health` 는 서버 일이 거의 없어 「네트워크 + Cloudflare Tunnel」 바닥값으로 같이 잰다.
질문(POST)은 개발 DB 에 행을 남기고 IP 당 분당 10건 제한이 있어 --question-runs(기본 3)만 잰다.
"""

import argparse
import gzip
import http.client
import json
import math
import statistics
import time
import urllib.parse

UA = "IssueAtlasDeploymentCheck/1.0"


class Client:
    def __init__(self, base):
        url = urllib.parse.urlsplit(base)
        conn = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
        self.conn = conn(url.netloc, timeout=60)
        self.cookies = {}

    def call(self, method, path, body=None, headers=None):
        h = {"User-Agent": UA, "Accept": "application/json", "Accept-Encoding": "gzip"}
        if self.cookies:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        h.update(headers or {})
        data = None if body is None else json.dumps(body).encode()
        if data is not None:
            h["Content-Type"] = "application/json"
        start = time.perf_counter()
        self.conn.request(method, path, body=data, headers=h)
        res = self.conn.getresponse()
        raw = res.read()
        ms = (time.perf_counter() - start) * 1000
        for name, value in res.getheaders():
            if name.lower() == "set-cookie":
                k, _, v = value.split(";", 1)[0].partition("=")
                self.cookies[k.strip()] = v.strip()
        text = gzip.decompress(raw) if res.getheader("Content-Encoding") == "gzip" else raw
        return res.status, ms, len(raw), (json.loads(text) if text else None)


def p95(values):
    ordered = sorted(values)
    return ordered[math.ceil(0.95 * len(ordered)) - 1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://dev-backend.issue-atlas.kr")
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--question-runs", type=int, default=3)
    parser.add_argument("--place", default="kr-12130", help="시군구 place_id (기본 여수시)")
    parser.add_argument("--card", default="C1")
    args = parser.parse_args()

    c = Client(args.base_url.rstrip("/"))
    period = {"period_start": "2023-01-01", "period_end": "2026-01-01"}
    q = urllib.parse.urlencode

    # 첫 연결(TCP + TLS) 비용은 따로 본다
    start = time.perf_counter()
    c.conn.connect()
    connect_ms = (time.perf_counter() - start) * 1000

    c.call("GET", "/v1/auth/csrf")
    token = urllib.parse.unquote(c.cookies.get("XSRF-TOKEN", ""))
    question = {"place_id": args.place, "card_id": args.card, **period, "raw_text": None}
    status, _, _, created = c.call("POST", "/v1/questions", question, {"X-XSRF-TOKEN": token})
    if status != 201:
        raise SystemExit(f"질문 실패 {status}: {created}")
    run_id = created["run_id"]
    _, _, _, argument = c.call("GET", f"/v1/arguments/{run_id}")
    evidence = next(
        i["evidence_id"]
        for items in argument["data"].values()
        if isinstance(items, list)
        for i in items
        if isinstance(i, dict) and i.get("evidence_id")
    )

    place, n = args.place, args.runs
    observations = q({"place_id": place, "card_id": "A3", **period})
    targets = [
        ("health (바닥값)", "GET", "/actuator/health", None, n),
        ("GET /v1/places", "GET", "/v1/places", None, n),
        ("GET /v1/places/{id}/cards", "GET", f"/v1/places/{place}/cards?{q(period)}", None, n),
        ("GET /v1/places/{id}/boundaries", "GET", f"/v1/places/{place}/boundaries", None, n),
        ("GET /v1/arguments/{run_id}", "GET", f"/v1/arguments/{run_id}", None, n),
        ("GET /v1/evidence/{id}", "GET", f"/v1/evidence/{evidence}", None, n),
        ("GET /v1/observations (A3)", "GET", f"/v1/observations?{observations}", None, n),
        ("POST /v1/questions", "POST", "/v1/questions", question, args.question_runs - 1),
    ]

    print(f"base={args.base_url} place={args.place} card={args.card} runs={args.runs}")
    print(f"첫 연결(TCP + TLS) {connect_ms:.0f} ms\n")
    print("| API | 횟수 | 중앙값 ms | p95 ms | 최대 ms | 응답 바이트(gzip) |")
    print("| --- | ---: | ---: | ---: | ---: | ---: |")
    for label, method, path, body, runs in targets:
        if runs <= 0:
            continue
        times, size = [], 0
        for _ in range(runs):
            headers = {"X-XSRF-TOKEN": token} if method == "POST" else None
            status, ms, size, payload = c.call(method, path, body, headers)
            if status >= 400:
                raise SystemExit(f"{label} 실패 {status}: {payload}")
            times.append(ms)
        print(
            f"| {label} | {runs} | {statistics.median(times):.0f} | {p95(times):.0f} "
            f"| {max(times):.0f} | {size:,} |"
        )


if __name__ == "__main__":
    main()
