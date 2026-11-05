#!/usr/bin/env python3
"""개발 서버 매일 수집 (S15P31C108-251).

issueatlas-collect-daily.timer 가 매일 03:00 KST(04:00 DB 백업 전)에 부른다. 수집은 단계마다 서버 실행기
issueatlas-collect 를 불러 돌린다 — 잠금 · 로그 · 사용 이미지 · 수집 뒤 정제(refine --changed-since)는 실행기 몫이다.
개발(develop)만 돈다. 넣지 않은 출처와 이유는 deploy/collector/README.md 「매일 예약 실행」.
"""

import datetime as dt
import json
import subprocess
import sys
from zoneinfo import ZoneInfo

COLLECT = "/usr/local/sbin/issueatlas-collect"
KST = ZoneInfo("Asia/Seoul")
# 여수 게시판은 최신 글부터 100건씩 준다. 14일이면 1–2쪽(11/5 첫 실행 116건)이고, 하루 이틀 빠져도 다음 실행이 채운다
PRESS_DAYS = 14


def steps(today):
    """순서대로 도는 (이름, 실행기 인자, 먼저 성공해야 하는 단계)."""
    start = today - dt.timedelta(days=PRESS_DAYS)
    return [
        (
            "press_yeosu",
            ["press", "--site", "yeosu", "--db", "--start", start.isoformat(), "--end", today.isoformat()],
            None,
        ),
        ("youth_policy", ["youth-policy"], None),
        # 기존 대응 후보는 정제된 온통청년 정책에서 뽑는다 — 온통청년 수집 · 정제가 성공했을 때만
        ("responses", ["responses"], "youth_policy"),
    ]


def run_all(today, run=subprocess.run):
    """단계마다 실행기 종료 코드. 앞 단계가 실패해도 이어지는 독립 단계는 돈다."""
    results = {}
    for name, arguments, needs in steps(today):
        if needs and results.get(needs) != 0:
            results[name] = "skipped"
            continue
        # 실행기를 중간에 죽이면 잠금만 풀리고 수집 컨테이너는 남으므로 단계별 시간 제한은 두지 않는다(unit 이 전체를 묶는다)
        results[name] = run([COLLECT, "--environment", "develop", *arguments], check=False).returncode
    return results


def main(now=None, run=subprocess.run):
    today = (now or dt.datetime.now(KST)).astimezone(KST).date()
    results = run_all(today, run)
    print(json.dumps({"date": today.isoformat(), "results": results}), flush=True)
    return 0 if all(code == 0 for code in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
