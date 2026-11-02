"""법정동 코드에서 만든 지명 사전.

data/region_names.tsv: 행정안전부 법정동 코드(2026-10-01 판, 통합시 반영) 중 「존재」 행만,
우리 통합시(12)의 시군구 · 읍면동 · 리 전부와 전국 시군구 이름.
열은 code(10자리) · name(시도부터 띄어 쓴 전체 이름).
"""

from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from .labels import GJ_GU, SIDO

NAMES_FILE = Path(__file__).resolve().parent / "data" / "region_names.tsv"
_SIDO_SHORT = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기",
    "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북",
    "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주",
}  # fmt: skip


@dataclass(frozen=True)
class Emd:
    sgg: str  # '여수시', '광주 서구'
    emd: str  # '소라면', '양동'
    code: str  # 법정동 10자리


@dataclass
class Places:
    sgg: dict[str, str] = field(default_factory=dict)  # 짧은 이름 → 시군구 ('여수' → '여수시')
    sgg_code: dict[str, str] = field(default_factory=dict)  # 시군구 → 법정동 10자리
    emd: dict[str, list[Emd]] = field(default_factory=dict)  # 읍면동 · 리 이름 → 후보
    other_sgg: dict[str, str] = field(default_factory=dict)  # 다른 시도의 시군구 이름 → 시도 줄임말


def _rows() -> list[tuple[str, str]]:
    lines = NAMES_FILE.read_text(encoding="utf-8").splitlines()[1:]
    return [tuple(line.split("\t", 1)) for line in lines if "\t" in line]


@cache
def load() -> Places:
    p = Places()
    others: dict[str, set[str]] = {}
    prefix = SIDO + " "
    for code, name in _rows():
        if name.startswith(prefix):
            parts = name[len(prefix) :].split(" ")
            is_gu = parts[0] in GJ_GU
            sgg = f"광주 {parts[0]}" if is_gu else parts[0]
            if len(parts) == 1:
                p.sgg_code[sgg] = code
                if not is_gu:
                    p.sgg[parts[0].removesuffix("시").removesuffix("군")] = sgg
            else:  # 리는 상위 읍면으로 올린다
                p.emd.setdefault(parts[-1], []).append(Emd(sgg, parts[1], code))
            continue
        sido, *rest = name.split(" ")
        short = _SIDO_SHORT.get(sido)
        if short and rest and code[5:] == "00000":  # 「천안시 동남구」 → 천안시
            sgg = rest[0]
            for key in {sgg, sgg.removesuffix("시").removesuffix("군").removesuffix("구")}:
                if len(key) >= 2:
                    others.setdefault(key, set()).add(short)
    # 두 시도 이상에 있는 이름(고성 · 동구 …)은 어느 시도인지 몰라 쓰지 않는다
    p.other_sgg = {key: s.pop() for key, s in others.items() if len(s) == 1}
    return p
