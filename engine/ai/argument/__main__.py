"""개발용: 판정 입력 파일과 기사 목록 파일로 문장화를 한 번 돌려 결과를 출력한다.

DB 에 쓰지 않는다. 운영 경로는 backend → engine POST /v1/argument/phrase.

    uv --directory engine run python -m ai.argument <판정 입력> <기사> [--card <카드>]

판정 입력은 contracts/ai judgment-input, 기사는 C2 articles[] 배열.
카드 승인본은 카드 파일(기본 contracts/cards/<card_id>.json, 판정 입력과 같은 판).
"""

import argparse
import json
import sys
from pathlib import Path

from .phrase import phrase
from .prompt import article_sources

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
    card = read(args.card or CARDS / f"{judgment['question']['card_id']}.json")
    result = phrase(judgment, article_sources(read(args.articles)), card)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result.result(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
