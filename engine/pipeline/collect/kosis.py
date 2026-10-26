"""DT_1B26001 연간 순이동(계, 20–24세). 원천 코드를 그대로 보존한다."""

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, build_opener

ENDPOINT = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
REGIONS = ("46130", "29110", "29140", "29155", "29170", "29200")
VERSION = "kosis-0.1.0"
LICENSE = "KOSIS-활용약관"
INDICATOR_ID = "population_net_migration"
MAX_BYTES = 10 * 1024 * 1024


class CollectionError(Exception):
    """외부 응답·예외 문자열을 포함하지 않는 고정 원인 코드."""


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

    def params(self, region):
        return {
            "method": "getList",
            "orgId": "101",
            "tblId": "DT_1B26001",
            "objL1": region,
            "objL2": "0",
            "objL3": "120",
            "itmId": "T25",
            "prdSe": "Y",
            "startPrdDe": str(self.start),
            "endPrdDe": str(self.end),
            "format": "json",
            "jsonVD": "Y",
            "smblChk": "Y",
        }

    def identity(self):
        return {"query": self.params("|".join(self.regions)), "indicator_id": self.indicator_id}


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


def to_records(rows: list[dict], query: Query, run_id: str, collected_at: str) -> list[dict]:
    records = []
    seen = set()
    for row in rows:
        try:
            if not isinstance(row, dict) or any(not isinstance(v, str) for v in row.values()):
                raise ValueError
            region, year = row["C1"], int(row["PRD_DE"])
            if (row["ORG_ID"], row["TBL_ID"], row["C2"], row["C3"], row["ITM_ID"]) != (
                "101",
                "DT_1B26001",
                "0",
                "120",
                "T25",
            ) or row["PRD_SE"] not in ("A", "Y"):
                raise ValueError
            if region not in query.regions or not query.start <= year <= query.end:
                raise ValueError
            if row["UNIT_NM"] != "명" or (region, year) in seen:
                raise ValueError
            seen.add((region, year))
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
                "observed_period_type": "Y",
                "observed_period_start": f"{year:04d}-01-01T00:00:00+09:00",
                "observed_period_end": f"{year + 1:04d}-01-01T00:00:00+09:00",
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
                    "tbl_id": row["TBL_ID"],
                    "C1": region,
                    "C2": row["C2"],
                    "C3": row["C3"],
                    "itm_id": row["ITM_ID"],
                    "prd_de": row["PRD_DE"],
                },
                "dedup_key": f"kosis:DT_1B26001:{region}:0:120:T25:Y:{year}:{changed}",
                "license_type": query.license_type,
                "storage_scope": "full",
                "run_id": run_id,
                "collector_version": VERSION,
            }
        )
    expected = {(r, y) for r in query.regions for y in range(query.start, query.end + 1)}
    if seen != expected:
        raise CollectionError("KOSIS_INCOMPLETE_RESPONSE")
    return records
