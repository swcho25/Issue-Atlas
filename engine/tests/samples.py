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
# 합성 빅카인즈 기사 (본문 수집 ok · full). 계약 예시는 이용허락이 미정이라 정제 테스트가 바꿔 쓴다
NEWS = [load("bigkinds-news")]
# 이용허락이 정해진 관측값 레코드 (측정소정보는 license_type 이 아직 TBD)
OBSERVATIONS = KOSIS + AIRKOREA
OBSERVATION_IDS = [r["dedup_key"] for r in OBSERVATIONS]
