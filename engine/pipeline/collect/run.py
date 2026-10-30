"""API 호출 전 실행 이력 생성 → 전체 검증 → raw 저장 → C1 출력."""

import json
import os
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from pipeline.refine.validate import validate

from .kosis import CollectionError, Query, fetch_rows, to_records


def write_records(path: Path, records):
    # 완성된 JSON만 보이게 같은 디렉터리에서 원자 교체한다.
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as f:
            temporary = Path(f.name)
            json.dump(records, f, ensure_ascii=False, indent=2, allow_nan=False)
            f.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def collect(query: Query, api_key: str, store, output: Path, fetch=fetch_rows):
    run_id = "kosis_" + uuid4().hex
    collected_at = datetime.now(UTC).isoformat()
    store.start(query, run_id, collected_at)
    stats = {"received": 0, "inserted": 0, "duplicates": 0, **query.run_params()}
    try:
        if not api_key:
            raise CollectionError("KOSIS_KEY_MISSING")
        rows = []
        for region in query.regions:
            batch = fetch(query, region, api_key)
            # 각 요청의 응답을 해당 지역·기간과 대조한다(지역 혼선/부분 성공 방지).
            to_records(batch, replace(query, regions=(region,)), run_id, collected_at)
            rows.extend(batch)
        stats["received"] = len(rows)
        records = to_records(rows, query, run_id, collected_at)
        if any(validate(record) for record in records):
            raise CollectionError("C1_INTAKE_VALIDATION_FAILED")
        try:
            stats["inserted"] = store.save(rows, records)
        except Exception:
            raise CollectionError("DB_WRITE_FAILED") from None
        stats["duplicates"] = len(rows) - stats["inserted"]
        try:
            write_records(output, records)
        except OSError:
            raise CollectionError("C1_EXPORT_FAILED") from None
    except BaseException as exc:
        status = "aborted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed"
        code = str(exc) if isinstance(exc, CollectionError) else "COLLECTION_FAILED"
        store.finish(run_id, status, stats | {"error_code": code})
        raise CollectionError(code) from None
    store.finish(run_id, "ok", stats)
    return {"run_id": run_id, **stats}
