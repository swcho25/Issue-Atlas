"""KOSIS 표(카드 C1 SP01·SP02·SP10)를 지역별로 받아 C1로 바꾼다. 원천 코드를 그대로 보존한다."""

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from itertools import product
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, build_opener

ENDPOINT = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
REGIONS = ("46130", "29110", "29140", "29155", "29170", "29200")
VERSION = "kosis-0.2.0"
LICENSE = "KOSIS-활용약관"
INDICATOR_ID = "population_net_migration"
MAX_BYTES = 10 * 1024 * 1024


class CollectionError(Exception):
    """외부 응답·예외 문자열을 포함하지 않는 고정 원인 코드."""


@dataclass(frozen=True)
class Table:
    """표 하나의 고정 정의. objL1 은 대상 지역, dims 는 objL2부터 받을 코드다."""

    tbl_id: str
    item_id: str
    prd_se: str  # "Y" 연 · "M" 월
    dims: tuple[tuple[str, ...], ...]
    indicator_id: str

    def definition(self):
        return {
            "tbl_id": self.tbl_id,
            "item_id": self.item_id,
            "prd_se": self.prd_se,
            "dims": [list(codes) for codes in self.dims],
        }


# 전입 시도. 12(전남광주통합특별시)는 2026 이후 코드, 99(국외)는 2023–2025 가 모두 0 이라 뺐다.
SIDO = tuple("00 11 26 27 28 29 30 31 36 41 51 43 44 52 46 47 48 50".split())
# 1세별 연령 코드: 계, 19세(1005), 20–39세(1201…1605).
AGES = ("000", "1005", *(f"{g}0{i}" for g in (12, 13, 15, 16) for i in range(1, 6)))
TABLES = {
    # 월별 순이동. 성별 계 · 연령 계, 청년 19–34세(901), 19–39세(905)
    "SP01": Table("DT_1B26001", "T25", "M", (("0",), ("000", "901", "905")), INDICATOR_ID),
    # 월별 전출지(대상 지역) → 전입지(시도) 이동자 수. 성별 계
    "SP02": Table("DT_1B26003_A02", "T70", "M", (SIDO, ("0",)), "population_movers"),
    # 연별(12월 말) 1세별 주민등록인구
    "SP10": Table("DT_1B04006", "T2", "Y", (AGES,), "population_registered"),
}
# C1 예시·테스트 원천(contracts/c1/examples/raw)의 범위: 연 · 성별 계 · 20–24세.
EXAMPLE_TABLE = Table("DT_1B26001", "T25", "Y", (("0",), ("120",)), INDICATOR_ID)
PRD_SE = {"Y": ("A", "Y"), "M": ("M",)}


@dataclass(frozen=True)
class Query:
    source_name: ClassVar[str] = "KOSIS 인구이동"
    source_org: ClassVar[str] = "KOSIS"
    license_type: ClassVar[str] = LICENSE
    collector_version: ClassVar[str] = VERSION
    method: ClassVar[str] = "api"
    indicator_id: str = INDICATOR_ID
    start: int = 2023
    end: int = 2025
    regions: tuple[str, ...] = REGIONS
    source_id: str = "S01"
    spec_id: str = "SP01"
    table: Table = EXAMPLE_TABLE

    def __post_init__(self):
        if not 1900 <= self.start <= self.end <= 9998:
            raise CollectionError("INVALID_YEAR_RANGE")
        if not self.regions or len(set(self.regions)) != len(self.regions):
            raise CollectionError("INVALID_REGIONS")
        if any(code not in REGIONS for code in self.regions):
            raise CollectionError("INVALID_REGIONS")
        if any(not v.strip() for v in (self.indicator_id, self.source_id, self.spec_id)):
            raise CollectionError("MISSING_IDENTIFIER")
        if self.indicator_id.upper().startswith("TBD"):
            raise CollectionError("UNCONFIRMED_INDICATOR")

    def periods(self):
        years = range(self.start, self.end + 1)
        if self.table.prd_se == "Y":
            return [f"{y:04d}" for y in years]
        return [f"{y:04d}{m:02d}" for y in years for m in range(1, 13)]

    def params(self, region):
        t, periods = self.table, self.periods()
        return {
            "method": "getList",
            "orgId": "101",
            "tblId": t.tbl_id,
            "objL1": region,
            **{f"objL{i}": "+".join(codes) for i, codes in enumerate(t.dims, 2)},
            "itmId": t.item_id,
            "prdSe": t.prd_se,
            "startPrdDe": periods[0],
            "endPrdDe": periods[-1],
            "format": "json",
            "jsonVD": "Y",
            "smblChk": "Y",
        }

    def identity(self):
        # 사양에는 표 정의만 둔다. 기간·지역은 실행마다 달라도 되므로 job_run.stats 에 남는다.
        return self.table.definition() | {"indicator_id": self.indicator_id}

    def run_params(self):
        return {"start": self.start, "end": self.end, "regions": list(self.regions)}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # 인증키가 다른 URL/호스트로 전달되지 않게 리다이렉트를 거절한다.
        return None


def fetch_rows(query: Query, region: str, api_key: str) -> list[dict]:
    url = ENDPOINT + "?" + urlencode(query.params(region) | {"apiKey": api_key})
    try:
        with build_opener(NoRedirect()).open(url, timeout=30) as response:
            body = response.read(MAX_BYTES + 1)
    except HTTPError as exc:
        raise CollectionError(f"KOSIS_HTTP_{exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise CollectionError("KOSIS_NETWORK_ERROR") from None
    if len(body) > MAX_BYTES:
        raise CollectionError("KOSIS_RESPONSE_TOO_LARGE")
    try:
        text = body.decode("utf-8-sig")
        rows = json.loads(text)
    except (UnicodeError, ValueError):
        raise CollectionError("KOSIS_INVALID_JSON") from None
    # 오류 msg나 응답에 인증키가 반사되어도 저장/로그로 전달하지 않는다.
    if api_key in text or api_key in json.dumps(rows, ensure_ascii=False):
        raise CollectionError("KOSIS_SECRET_IN_RESPONSE")
    if isinstance(rows, dict):
        raise CollectionError("KOSIS_API_ERROR")
    if not isinstance(rows, list) or not rows:
        raise CollectionError("KOSIS_EMPTY_RESPONSE")
    return rows


def canonical(row: dict) -> str:
    return json.dumps(
        row, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    )


def period_bounds(prd_se: str, prd: str) -> tuple[str, str]:
    """한국 시각 [시작, 다음 기간 시작)."""
    year, month = int(prd[:4]), int(prd[4:] or 1)
    if prd_se == "Y":
        year_end, month_end = year + 1, 1
    else:
        year_end, month_end = year + month // 12, month % 12 + 1
    return (
        f"{year:04d}-{month:02d}-01T00:00:00+09:00",
        f"{year_end:04d}-{month_end:02d}-01T00:00:00+09:00",
    )


def to_records(rows: list[dict], query: Query, run_id: str, collected_at: str) -> list[dict]:
    t, periods = query.table, query.periods()
    records = []
    seen = set()
    for row in rows:
        try:
            if not isinstance(row, dict) or any(not isinstance(v, str) for v in row.values()):
                raise ValueError
            codes = tuple(row[f"C{i}"] for i in range(1, len(t.dims) + 2))
            region, prd = codes[0], row["PRD_DE"]
            if (row["ORG_ID"], row["TBL_ID"], row["ITM_ID"]) != ("101", t.tbl_id, t.item_id):
                raise ValueError
            # 요청하지 않은 분류 칸이 붙어 오면 다른 표로 보고 거절한다.
            if row["PRD_SE"] not in PRD_SE[t.prd_se] or f"C{len(t.dims) + 2}" in row:
                raise ValueError
            if any(c not in allowed for c, allowed in zip(codes[1:], t.dims, strict=True)):
                raise ValueError
            if region not in query.regions or prd not in periods:
                raise ValueError
            if row["UNIT_NM"] != "명" or (*codes, prd) in seen:
                raise ValueError
            seen.add((*codes, prd))
            # 빈칸만 결측 처리한다. 통계 부호의 의미를 추측해 0/결측으로 바꾸지 않는다.
            dt = row["DT"].strip()
            if dt and not re.fullmatch(r"[-+]?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.0+)?", dt):
                raise ValueError
            value = None if not dt else Decimal(dt.replace(",", ""))
            if value is not None and (not value.is_finite() or value != value.to_integral_value()):
                raise ValueError
            changed = row.get("LST_CHN_DE", "")
            published = date.fromisoformat(changed).isoformat() if changed else None
        except (KeyError, ValueError, TypeError, InvalidOperation):
            raise CollectionError("KOSIS_INVALID_ROW") from None
        start, end = period_bounds(t.prd_se, prd)
        content_hash = "sha256:" + hashlib.sha256(canonical(row).encode("utf-8")).hexdigest()
        records.append(
            {
                "source_id": query.source_id,
                "spec_id": query.spec_id,
                "raw_url": ENDPOINT + "?" + urlencode(query.params(region)) + "&apiKey=<KEY>",
                "file_name": None,
                "content_hash": content_hash,
                "collected_at": collected_at,
                "published_at": published + "T00:00:00+09:00" if published else None,
                "observed_at": None,
                "observed_at_source": None,
                "observed_period_type": t.prd_se,
                "observed_period_start": start,
                "observed_period_end": end,
                "place_code_raw": region,
                "place_code_system": "kosis",
                "place_id": None,
                "place_map_status": "unmapped",
                "geometry": None,
                "location_precision": "none",
                "geometry_role": None,
                "indicator_id": query.indicator_id,
                "value": int(value) if value is not None else None,
                "unit": "명",
                "missing_reason": "not_published" if value is None else None,
                "is_provisional": False,
                "locator": {
                    "tbl_id": t.tbl_id,
                    **{f"C{i}": c for i, c in enumerate(codes, 1)},
                    "itm_id": t.item_id,
                    "prd_de": prd,
                },
                "dedup_key": ":".join(
                    ("kosis", t.tbl_id, *codes, t.item_id, t.prd_se, prd, changed)
                ),
                "license_type": query.license_type,
                "storage_scope": "full",
                "run_id": run_id,
                "collector_version": VERSION,
            }
        )
    if seen != set(product(query.regions, *t.dims, periods)):
        raise CollectionError("KOSIS_INCOMPLETE_RESPONSE")
    return records
