"""기사 본문 수집 실행.

python -m pipeline.article <빅카인즈 뉴스 검색 응답 JSON 파일>
    → 기사마다 결과 JSONL (stdout), 상태별 건수 JSON (stderr)

빅카인즈 요청 fields 에 provider_link_page · content 가 있어야 한다 (content 로 같은 기사인지 본다).
출력에 기사 본문이 들어간다. 저장소 안에 두거나 커밋하지 않는다.
"""

import json
import sys
from collections import Counter
from pathlib import Path

from .run import fetch_articles

USAGE = "사용법: python -m pipeline.article <빅카인즈 뉴스 검색 응답 JSON 파일>"


def main(argv: list[str], **options) -> int:
    if len(argv) != 1:
        print(USAGE, file=sys.stderr)
        return 2
    data = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    found = data.get("return_object") if isinstance(data, dict) else None
    documents = found.get("documents") if isinstance(found, dict) else None
    if not isinstance(documents, list):
        print("BIGKINDS_DOCUMENTS_MISSING", file=sys.stderr)
        return 2
    counts = Counter()
    # Windows 에서도 줄바꿈이 \r\n 으로 바뀌지 않게 바이트로 쓴다
    out = sys.stdout.buffer
    for result in fetch_articles(documents, **options):
        counts[result["status"]] += 1
        out.write(json.dumps(result, ensure_ascii=False, sort_keys=True).encode("utf-8") + b"\n")
        out.flush()
    print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
