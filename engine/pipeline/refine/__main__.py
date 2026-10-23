"""python -m pipeline.refine <C1 레코드 JSON 배열 파일> → 정제 레코드 JSONL (stdout)."""

import json
import sys
from pathlib import Path

from .run import refine_records
from .serialize import dumps_record


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("사용법: python -m pipeline.refine <C1 레코드 JSON 배열 파일>", file=sys.stderr)
        return 2
    records = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    # Windows 에서도 줄바꿈이 \r\n 으로 바뀌지 않게 바이트로 쓴다
    out = sys.stdout.buffer
    for refined in refine_records(records):
        out.write(dumps_record(refined).encode("utf-8") + b"\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
