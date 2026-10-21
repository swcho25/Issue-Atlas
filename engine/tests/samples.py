"""P1 C1 실데이터 샘플 (출처는 fixtures/p1/README.md). 고치기 전에 deepcopy 한다."""

import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "p1"
HASH = "sha256:" + "0" * 64


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


KOSIS = load("kosis_net_migration.json")
AIRKOREA = load("airkorea_final_pm25.json")
P1_SAMPLES = KOSIS + AIRKOREA
SAMPLE_IDS = [r["dedup_key"] for r in P1_SAMPLES]
