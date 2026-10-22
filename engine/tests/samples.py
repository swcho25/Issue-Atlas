"""C1 계약 예시 레코드 (contracts/c1/examples, 장성우 · P1 실제 수집 값). 고치기 전에 deepcopy 한다."""

import json
from pathlib import Path

EXAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "c1" / "examples"
HASH = "sha256:" + "0" * 64


def load(name):
    return json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))


KOSIS = [load("kosis-net-migration")]
# 서강동 PM2.5: 01시 정상 25 · 02시 빈칸 · 24시 표기(다음 날 00시)
AIRKOREA = [
    load("airkorea-measure"),
    load("airkorea-measure-missing"),
    load("airkorea-measure-hour24"),
]
# 측정소 좌표 메타 레코드 (indicator_id·value 없음)
STATION = [load("airkorea-station")]
P1_SAMPLES = KOSIS + AIRKOREA + STATION
SAMPLE_IDS = [r["dedup_key"] for r in P1_SAMPLES]
# 이용허락이 정해진 관측값 레코드 (측정소정보는 license_type 이 아직 TBD)
OBSERVATIONS = KOSIS + AIRKOREA
OBSERVATION_IDS = [r["dedup_key"] for r in OBSERVATIONS]
