"""region-export 의 기사 JSONL → 모델 서버에 지역 · 요약 질문 → region-load 입력 JSONL.

python -m pipeline.region.extract --input <articles.jsonl> --output <extract.jsonl>
                                  [--done <이전 결과>]
                                                                     → 건수 JSON (stdout)
- 모델 서버는 .env 의 P3_LLM_* (llm.py). 없으면 아무것도 쓰지 않고 P3_LLM_NOT_CONFIGURED 로 끝난다
- 기사마다 지역(answer_region, p9.1) · 요약 · 시간(answer_summary, s1.1)을 동시에 묻는다(묶음 64건)
- 한 묶음에서 절반 넘게 답이 깨지면(지역 JSON 아님 · 요약 없음) 그 묶음은 쓰지 않고 멈춘다 —
  vLLM AWQ 가 동시 요청에 「{"!!!!…」를 내거나 엔진이 죽은 일(2026-10-29 · 11-01). 다시 돌릴 때
  --done 에 이전 결과를 주면 이미 뽑은 기사는 건너뛴다(결과 파일은 실행마다 새로 쓴다)
- 결과 한 줄: id · sigungu · emd · mentions · places · orgs · summary · event_start · event_end ·
  time_precision · time_basis · notes · model · prompt_version · summary_version. 본문은 넣지 않는다
"""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import answer_region, answer_summary
from .llm import LlmError, ModelServer

BATCH = 64


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def broken(rows: list[dict]) -> bool:
    """답이 깨진 묶음: 절반 넘게 지역 · 요약 답이 모두 실패했다(서버가 깨진 답을 내거나 안 됨).
    한 기사만 지역 JSON 이 깨진 것(요약은 됨)은 그 기사 문제라 보류로 쓰고 지나간다 — lab 은 이것도
    묶음 실패로 봐서 1건 다시 돌리기가 멈췄다(04100078.20251202064952001, 2026-11-02)"""
    bad = sum(r["sigungu"] == "보류" and not r["summary"] for r in rows)
    return bad * 2 > len(rows)


def extract_one(article: dict, ask, region_raw: str | None, summary_raw: str | None) -> dict:
    """한 기사. 모델 서버가 실패하면 지역은 보류, 요약은 비우고 발행 시각으로 남긴다"""
    try:
        region = answer_region.answer(article, ask, region_raw)
    except LlmError as exc:
        region = {"sigungu": "보류", "emd": "", "mentions": [], "places": [], "orgs": [],
                  "notes": {"오류": f"지역: {exc}"}}  # fmt: skip
    try:
        summary = answer_summary.answer(article, ask, summary_raw)
    except LlmError as exc:
        start, end, precision, _ = answer_summary.event_period({}, article["published_at"])
        summary = {"summary": "", "event_start": start, "event_end": end,
                   "time_precision": precision, "time_basis": "",
                   "notes": {"오류": f"요약: {exc}"}}  # fmt: skip
    notes = {**region.pop("notes"), **summary.pop("notes")}
    return {"id": article["id"], **region, **summary, "notes": notes}


def extract(articles: list[dict], ask, out, workers: int = 4, model: str = "") -> dict:
    """묶음마다 지역 · 요약 첫 질문을 동시에 보내고, 재질문 · 확인은 기사마다 차례로.
    묶음마다 out 에 쓴다"""
    versions = {"prompt_version": answer_region.PROMPT_VERSION,
                "summary_version": answer_summary.SUMMARY_VERSION}  # fmt: skip
    stats = {"written": 0, "held": 0}

    def first(job):
        system, user, max_tokens = job
        try:
            return ask(system, user, max_tokens)
        except LlmError:
            return None  # 아래 answer 에서 한 번 더 묻는다

    with ThreadPoolExecutor(workers) as pool:
        for i in range(0, len(articles), BATCH):
            chunk = articles[i : i + BATCH]
            jobs = [(answer_region.SYSTEM, answer_region.user_message(a), answer_region.MAX_TOKENS)
                    for a in chunk]  # fmt: skip
            jobs += [(answer_summary.SYSTEM, answer_summary.user_message(a),
                      answer_summary.MAX_TOKENS) for a in chunk]  # fmt: skip
            raws = list(pool.map(first, jobs))
            rows = [
                extract_one(a, ask, raws[k], raws[len(chunk) + k]) | {"model": model, **versions}
                for k, a in enumerate(chunk)
            ]
            if broken(rows):
                stats["stopped_at"] = stats["written"]
                return stats
            out.write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
            out.flush()
            stats["written"] += len(rows)
            stats["held"] += sum(r["sigungu"] == "보류" for r in rows)
    return stats


def main(argv=None, server=ModelServer.from_env) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--done", type=Path, action="append", default=[], help="이미 뽑은 결과(건너뜀)")
    args = p.parse_args(argv)
    ask = server()
    if ask is None:
        print("P3_LLM_NOT_CONFIGURED", file=sys.stderr)
        return 1
    try:
        done = {r["id"] for path in args.done for r in read_jsonl(path)}
        articles = [a for a in read_jsonl(args.input) if a["id"] not in done]
        with args.output.open("w", encoding="utf-8") as out:
            stats = extract(articles, ask, out, ask.workers, ask.model)
        result = {"input": len(articles) + len(done), "skipped_done": len(done), **stats}
        print(json.dumps(result, ensure_ascii=False))
        return 2 if "stopped_at" in stats else 0
    except Exception:
        # 기사 본문 · 모델 서버 주소가 담길 수 있는 예외 문구는 출력하지 않는다
        print("REGION_EXTRACT_FAILED", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
