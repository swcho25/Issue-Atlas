"""법정동 코드에서 만든 지명 사전.

data/region_names.tsv: 행정안전부 법정동 코드(2026-10-01 판, 통합시 반영) 중 「존재」 행만,
우리 통합시(12)의 시군구 · 읍면동 · 리 전부와 전국 시군구 이름.
열은 code(10자리) · name(시도부터 띄어 쓴 전체 이름).
not_a_place: LLM 이 뽑은 장소 중 주소가 없는 것(행정 이름 · 누리집 · 시청 부서)을 거른다.
"""

import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from .labels import GJ_GU, SIDO, SIDO_SHORT

NAMES_FILE = Path(__file__).resolve().parent / "data" / "region_names.tsv"


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
        short = SIDO_SHORT.get(sido)
        if short and rest and code[5:] == "00000":  # 「천안시 동남구」 → 천안시
            sgg = rest[0]
            for key in {sgg, sgg.removesuffix("시").removesuffix("군").removesuffix("구")}:
                if len(key) >= 2:
                    others.setdefault(key, set()).add(short)
    # 두 시도 이상에 있는 이름(고성 · 동구 …)은 어느 시도인지 몰라 쓰지 않는다
    p.other_sgg = {key: s.pop() for key, s in others.items() if len(s) == 1}
    return p


_ADMIN = {
    "광주",
    "전남",
    "전남광주",
    "전남광주시",
    "전남광주통합특별시",
    "광주광역시",
    "전라남도",
    "호남",
}
_OFFICE_BARE = {
    "시청",
    "도청",
    "구청",
    "군청",
    "시의회",
    "도의회",
    "구의회",
    "군의회",
    "교육청",
    "청사",
}
_ADMIN_SUFFIX = re.compile(r"(.+?)(?:특별시|광역시|특별자치도|도|시|군|구)")
# 장소가 아닌 것: 누리집 · 플랫폼 같은 온라인 창구, 사업 · 캠페인 이름 (p7.1)
_NOT_PLACE = re.compile(
    r"(?:누리집|홈페이지|플랫폼|사이트|누리소통망|유튜브|블로그|앱|어플|사업|프로그램|캠페인|공모전)$"
)
# 「광주시 기후대기정책과」 · 「여수시청 청년일자리과」 처럼
# 행정기관 이름 뒤에 붙은 부서 이름 (p7.2)
_DEPT = re.compile(r"(?:과|팀|국|담당관|지원단|추진단)$")


def _key(name: str) -> str:
    """이름 비교용: 띄어쓰기 · 붙임표 · 가운뎃점 · 괄호를 뺀다"""
    return re.sub(r"[\s\-·ㆍ.()]", "", str(name))


def is_admin_name(name: str) -> bool:
    """「광주시」 · 「광산구」 · 「시청」 · 「학동」 처럼 행정 이름뿐인 것.
    「여수시청」 · 「북구청」 은 건물이라 아니다"""
    p, k = load(), _key(name)
    if not k or k in _ADMIN or k in _OFFICE_BARE or k in p.sgg or k in p.emd:
        return True
    if k in {s.replace(" ", "") for s in p.sgg_code} or k in {s.split(" ")[-1] for s in p.sgg_code}:
        return True
    m = _ADMIN_SUFFIX.fullmatch(k)
    return bool(m and (m.group(1) in _ADMIN or m.group(1) in p.sgg))


def not_a_place(name: str) -> bool:
    """행정 이름이거나 온라인 창구 · 사업 이름 · 시청 부서라 주소가 없는 것"""
    if is_admin_name(name) or _NOT_PLACE.search(_key(name)):
        return True
    words = str(name).split()
    head = _key(words[0]) if len(words) >= 2 else ""
    return bool(
        head
        and _DEPT.search(_key(words[-1]))
        and (is_admin_name(head) or head.endswith(("청", "의회")))
    )
