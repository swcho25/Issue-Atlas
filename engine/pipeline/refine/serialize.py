"""정제 레코드의 정규 직렬화. 같은 레코드는 언제 어디서 돌려도 같은 바이트가 된다."""

import json


def dumps_record(record: dict) -> str:
    # 키 정렬 · 공백 없음 · 한글 그대로
    return json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
