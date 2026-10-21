import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "p1"


@pytest.fixture
def passing_record():
    """content_hash 만 채운 KOSIS 실샘플. 다른 규칙에는 걸리지 않는다."""
    samples = json.loads((FIXTURES / "kosis_net_migration.json").read_text(encoding="utf-8"))
    return {**samples[0], "content_hash": "sha256:" + "0" * 64}
