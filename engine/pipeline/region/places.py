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


# 2026-07 통합 전 법정동 코드 앞 5자리(광주 29 · 전남 46) → 통합 뒤(12). 뒤 5자리(읍면동 · 리)는
# 그대로다(법정동 코드 파일의 폐지 · 존재 행 3,176쌍, 2026-11-03). 주소 API 가 옛 코드를 줄 때 쓴다
OLD_SGG = {
    "29110": "12210", "29140": "12240", "29155": "12270", "29170": "12300", "29200": "12330",
    "46110": "12110", "46130": "12130", "46150": "12150", "46170": "12170", "46230": "12190",
    "46710": "12710", "46720": "12720", "46730": "12730", "46770": "12740", "46780": "12750",
    "46790": "12760", "46800": "12770", "46810": "12780", "46820": "12790", "46830": "12800",
    "46840": "12810", "46860": "12820", "46870": "12830", "46880": "12840", "46890": "12850",
    "46900": "12860", "46910": "12870",
}  # fmt: skip
# 장소 이름 앞 시군구를 믿을 수 있는 구역 · 시설 끝말
# (붙여 쓴 이름에만. 「순천향대」 · 「목포대」는 그 시군구에 없다)
_AREA_END = (
    "산단", "산업단지", "농공단지", "지구", "공원", "IC", "나들목", "교차로", "항", "역",
    "해수욕장", "댐", "저수지", "터미널", "시장", "문화홀", "체육관", "도서관", "섬",
)  # fmt: skip


@cache
def _by_code() -> dict[str, tuple[str, str]]:
    p = load()
    out = {code: (sgg, "") for sgg, code in p.sgg_code.items()}
    for entries in p.emd.values():
        for e in entries:
            out.setdefault(e.code, (e.sgg, e.emd))
    return out


def by_code(code: str) -> tuple[str, str]:
    """법정동 코드 10자리 → (시군구, 읍면동). 리는 상위 읍면.
    우리 통합시 밖이거나 모르면 ('', '')"""
    code = str(code or "")
    code = OLD_SGG.get(code[:5], code[:5]) + code[5:]
    return _by_code().get(code) or (_by_code().get(code[:5] + "00000", ("", ""))[0], "")


def region_of_prefix(name: str) -> str:
    """이름 앞에 붙은 시군구: 「보성 조성농공단지」 → 보성군,
    「광주 북구 용봉동 행정복지센터」 → 광주 북구.
    붙여 쓴 이름(「여수화양농공단지」)은 끝말이 구역 · 시설일 때만. 못 찾으면 ''"""
    p, words = load(), str(name).split()
    if len(words) >= 2:
        if words[0] in ("광주", "광주광역시") and words[1] in GJ_GU:
            return f"광주 {words[1]}"
        head = words[0] if words[0] in p.sgg else words[0].removesuffix("시").removesuffix("군")
        if head in p.sgg:
            return p.sgg[head]
    k = _key(name)
    for short, full in p.sgg.items():
        if (
            len(short) >= 2
            and k.startswith(short)
            and len(k) > len(short) + 1
            and k.endswith(_AREA_END)
        ):
            return full
    return ""
