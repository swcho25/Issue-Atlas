"""개발용: 판정 입력 파일과 기사 목록 파일로 문장화를 한 번 돌려 결과를 출력한다.

DB 에 쓰지 않는다.

    uv --directory engine run python -m ai.argument <판정 입력> <기사> [--card <카드>]

판정 입력은 contracts/ai judgment-input, 기사는 C2 articles[] 배열. 금지어는 카드 파일(기본
contracts/cards/<card_id>.json)의 forbidden_terms. 실제 기사를 외부 모델로 보내도 되는지 확인 전이라
(contracts/ai 「열린 문제」) fixture 가 아닌 판정 입력은 멈춘다.
"""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .phrase import phrase

CARDS = Path(__file__).resolve().parents[3] / "contracts" / "cards"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.argument")
    parser.add_argument("judgment", type=Path)
    parser.add_argument("articles", type=Path)
    parser.add_argument("--card", type=Path)
    args = parser.parse_args(argv)
    judgment = read(args.judgment)
    if not judgment.get("fixture"):
        print("가상 판정 입력(fixture: true)만 외부 모델로 보냅니다", file=sys.stderr)
        return 2
    card = read(args.card or CARDS / f"{judgment['question']['card_id']}.json")
    result = phrase(judgment, read(args.articles), card.get("forbidden_terms", []))
    report = {**asdict(result), "retryable": result.retryable}
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
