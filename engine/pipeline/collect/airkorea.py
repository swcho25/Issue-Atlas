"""에어코리아 측정소 API와 최종확정 XLSX → C1 (원천 값은 보존)."""

import hashlib
import json
import math
import re
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode
from urllib.request import build_opener

from openpyxl import load_workbook

from .kosis import MAX_BYTES, CollectionError, NoRedirect, canonical

STATION_URL = "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList"
STATION_LICENSE_URL = "https://www.data.go.kr/data/15073877/openapi.do"
FINAL_URL = "https://www.airkorea.or.kr/web/detailViewDown?pMENU_NO=123"
VERSION = "airkorea-0.2.0"
KST = timezone(timedelta(hours=9))
HEADERS = (
    "지역",
    "망",
    "측정소코드",
    "측정소명",
    "측정일시",
    "아황산가스(SO2)",
    "일산화탄소(CO)",
    "오존(O3)",
    "이산화질소(NO2)",
    "미세먼지(PM10)",
    "초미세먼지(PM25)",
    "주소",
)
# 2023·2025 월별 파일 형식은 항목 열 이름이 짧다. 열 순서·값은 같다.
SHORT_HEADERS = (*HEADERS[:5], "SO2", "CO", "O3", "NO2", "PM10", "PM25", HEADERS[-1])
# 원천 열, 지표 ID, 단위. 수치는 변환·보간하지 않는다.
POLLUTANTS = (
    ("SO2", "air_so2", "ppm"),
    ("CO", "air_co", "ppm"),
    ("O3", "air_o3", "ppm"),
    ("NO2", "air_no2", "ppm"),
    ("PM10", "air_pm10", "µg/m³"),
    ("PM25", "air_pm25", "µg/m³"),
)


@dataclass(frozen=True)
class AirSpec:
    mode: str
    start: date = date(2024, 1, 1)
    end: date = date(2024, 1, 2)  # 원천 일자의 끝 미포함
    file_name: str | None = None
    data_status: str | None = None
    source_name: ClassVar[str] = "에어코리아"
    source_org: ClassVar[str] = "한국환경공단"
    license_type: ClassVar[str] = "KOGL-3"
    collector_version: ClassVar[str] = VERSION

    def __post_init__(self):
        if self.mode not in ("stations", "final"):
            raise CollectionError("AIRKOREA_INVALID_MODE")
        if not 0 < (self.end - self.start).days <= 31:
            raise CollectionError("AIRKOREA_INVALID_DATE_RANGE")
        if self.mode == "final" and not self.file_name:
            raise CollectionError("AIRKOREA_FILE_REQUIRED")
        if self.data_status not in (None, "confirmed", "provisional"):
            raise CollectionError("AIRKOREA_INVALID_DATA_STATUS")
        # 2025 잠정 자료를 연도만 보고 확정값으로 오인하지 않는다. 원천 상태를 명시한다.
        if (
            self.mode == "final"
            and (self.end - timedelta(days=1)).year >= 2025
            and self.data_status is None
        ):
            raise CollectionError("AIRKOREA_DATA_STATUS_REQUIRED")

    @property
    def source_id(self):
        return "airkorea_" + ("station" if self.mode == "stations" else "final")

    @property
    def spec_id(self):
        if self.mode == "stations":
            return "airkorea_stations_yeosu_gwangju"
        return "airkorea_final_yeosu_gwangju"

    @property
    def method(self):
        return "api" if self.mode == "stations" else "file"

    def identity(self):
        if self.mode == "stations":
            return {"endpoint": STATION_URL, "areas": ["여수", "광주"], "page_size": 100}
        return {
            "region": "여수·광주 5개 구",
            "indicators": [p[1] for p in POLLUTANTS],
        }

    def run_params(self):
        if self.mode == "stations":
            return {}
        return {
            "file_name": self.file_name,
            "start_date": self.start.isoformat(),
            "end_date_exclusive": self.end.isoformat(),
            "data_status": self.data_status or "confirmed",
        }


def in_target(text: str) -> bool:
    """경기 광주시·전국의 같은 이름 측정소가 들어오지 않게 행정명 경계를 확인한다."""
    return bool(
        re.search(
            r"(?:^|\s)여수시(?:\s|$)|^전남 여수(?:\s|$)|"
            r"^광주광역시(?:\s|$)|^광주 (?:동구|서구|남구|북구|광산구)(?:\s|$)|"
            # 2025 파일은 통합 시도명을 `전남광주`로 줄여 쓴다 (예: `전남광주 북구`)
            r"^전남광주(?:통합특별시)? (?:광주 )?(?:동구|서구|남구|북구|광산구)(?:\s|$)",
            text,
        )
    )


def area_of(text):
    if not in_target(text):
        return None
    return "여수" if re.search(r"(?:^|\s)여수시(?:\s|$)|^전남 여수(?:\s|$)", text) else "광주"


def get_page(area, page, api_key):
    # 포털 Encoding 키는 한 번 디코딩한 뒤 urlencode로 한 번만 인코딩한다.
    key = unquote(api_key)
    params = {"returnType": "json", "numOfRows": 100, "pageNo": page, "addr": area}
    url = STATION_URL + "?" + urlencode(params | {"serviceKey": key})
    try:
        with build_opener(NoRedirect()).open(url, timeout=30) as response:
            body = response.read(MAX_BYTES + 1)
    except HTTPError as exc:
        raise CollectionError(f"AIRKOREA_HTTP_{exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise CollectionError("AIRKOREA_NETWORK_ERROR") from None
    if len(body) > MAX_BYTES:
        raise CollectionError("AIRKOREA_RESPONSE_TOO_LARGE")
    try:
        text = body.decode("utf-8-sig")
        data = json.loads(text)
        if key in unquote(json.dumps(data, ensure_ascii=False)):
            raise CollectionError("AIRKOREA_SECRET_IN_RESPONSE")
        response = data["response"]
        if str(response["header"]["resultCode"]) not in ("00", "0"):
            raise CollectionError("AIRKOREA_API_ERROR")
        result = response["body"]
        total = int(result["totalCount"])
        items = result.get("items") or []
        if not isinstance(items, list) or not 0 <= total <= 10000:
            raise ValueError
        if int(result["pageNo"]) != page:
            raise ValueError
        return items, total
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise CollectionError("AIRKOREA_INVALID_RESPONSE") from None


def base_record(spec, run_id, at, payload, **fields):
    return {
        "source_id": spec.source_id,
        "spec_id": spec.spec_id,
        # 파일명·기간은 job_run.stats에 있다. 재배포 파일명은 같은 관측 칸을 바꾸지 않는다.
        "raw_url": FINAL_URL if spec.mode == "final" else None,
        "file_name": None,
        "content_hash": "sha256:" + hashlib.sha256(canonical(payload).encode("utf-8")).hexdigest(),
        "collected_at": at,
        "published_at": None,
        "observed_at": None,
        "observed_at_source": None,
        "observed_period_type": "none",
        "observed_period_start": None,
        "observed_period_end": None,
        "place_code_raw": "",
        "place_code_system": "airkorea_station_name",
        "place_id": None,
        "place_map_status": "unmapped",
        "geometry": None,
        "location_precision": "none",
        "geometry_role": "station",
        "indicator_id": None,
        "value": None,
        "unit": None,
        "missing_reason": None,
        "is_provisional": spec.data_status == "provisional",
        "locator": {},
        "dedup_key": "",
        "license_type": spec.license_type,
        "storage_scope": "full",
        "run_id": run_id,
        "collector_version": VERSION,
        **fields,
    }


def station_record(item, spec, run_id, at, raw_url):
    try:
        name, addr = item["stationName"], item["addr"]
        if not isinstance(name, str) or not name.strip() or not isinstance(addr, str):
            raise ValueError
        lat, lon = float(item["dmX"]), float(item["dmY"])
        if not (
            math.isfinite(lat) and math.isfinite(lon) and 33 <= lat <= 39 and 124 <= lon <= 132
        ):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise CollectionError("AIRKOREA_INVALID_STATION") from None
    return base_record(
        spec,
        run_id,
        at,
        item,
        raw_url=raw_url,
        place_code_raw=name,
        geometry={"type": "Point", "coordinates": [lon, lat]},
        location_precision="exact",
        locator={
            "stationName": name,
            "addr": addr,
            "mangName": item.get("mangName"),
            "year": item.get("year"),
        },
        dedup_key=f"airkorea_station:{name}:{addr}",
    )


def station_pairs(spec, run_id, at, api_key, fetch=get_page):
    if not api_key:
        raise CollectionError("AIRKOREA_KEY_MISSING")
    seen = set()
    for area in ("여수", "광주"):
        received, page, expected, selected = 0, 1, None, 0
        while True:
            items, total = fetch(area, page, api_key)
            if expected is None:
                expected = total
            if total != expected or not items:
                raise CollectionError("AIRKOREA_INCOMPLETE_RESPONSE")
            received += len(items)
            if received > total:
                raise CollectionError("AIRKOREA_INCONSISTENT_TOTAL")
            for item in items:
                if not isinstance(item, dict) or not isinstance(item.get("addr"), str):
                    raise CollectionError("AIRKOREA_INVALID_STATION")
                if area_of(item["addr"]) != area:
                    continue
                key = (item.get("stationName"), item["addr"])
                if key in seen:
                    raise CollectionError("AIRKOREA_DUPLICATE_STATION")
                seen.add(key)
                selected += 1
                safe_url = (
                    STATION_URL
                    + "?"
                    + urlencode(
                        {"returnType": "json", "numOfRows": 100, "pageNo": page, "addr": area}
                    )
                    + "&serviceKey=<KEY>"
                )
                yield item, station_record(item, spec, run_id, at, safe_url)
            if received == total:
                if not selected:
                    raise CollectionError("AIRKOREA_NO_TARGET_STATIONS")
                break
            page += 1


def hour_end(value):
    text = str(value)
    if not re.fullmatch(r"[0-9]{10}", text) or not 1 <= int(text[-2:]) <= 24:
        raise CollectionError("AIRKOREA_INVALID_HOUR")
    try:
        day = datetime.strptime(text[:8], "%Y%m%d").replace(tzinfo=KST)
    except ValueError:
        raise CollectionError("AIRKOREA_INVALID_HOUR") from None
    return day + timedelta(hours=int(text[-2:]))


def measurement_pairs(cells, sheet, row_number, spec, run_id, at, stations=()):
    if len(cells) != len(HEADERS):
        raise CollectionError("AIRKOREA_INVALID_COLUMNS")
    region, _, code, name, raw_time, *unused = cells
    if not all(isinstance(s, str) and s.strip() for s in (region, name)):
        raise CollectionError("AIRKOREA_INVALID_MEASUREMENT")
    code = str(code)
    if not re.fullmatch(r"[0-9]{6}", code):
        raise CollectionError("AIRKOREA_INVALID_STATION_CODE")
    end = hour_end(raw_time)
    if not in_target(region):
        return
    # 24시도 원천 일자로 필터링한다. 다음 날 00시는 이전 날 마지막 시간 구간이다.
    original_day = (end - timedelta(hours=1)).date()
    if not spec.start <= original_day < spec.end:
        return
    matches = [
        s
        for s in stations
        if s.get("place_code_raw") == name
        and s.get("source_id") == "airkorea_station"
        and s.get("geometry")
        and area_of(s.get("locator", {}).get("addr", "")) == area_of(region)
    ]
    geometry = matches[0]["geometry"] if len(matches) == 1 else None
    values = []
    for value in cells[5:11]:
        if isinstance(value, str) and not value.strip():
            value = None
        if value in (-999, "-999"):
            value = None
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or value < 0
        ):
            raise CollectionError("AIRKOREA_INVALID_VALUE")
        values.append(value)
    for column, (pollutant, indicator, unit) in enumerate(POLLUTANTS, start=5):
        value = values[column - 5]
        # 시트·파일은 포장 정보라 넣지 않는다. 형식이 달라도 같은 측정값은 같은 원본·같은 칸이다
        payload = {
            "cells": list(cells),
            "column": HEADERS[column],
            "data_status": spec.data_status or "confirmed",
        }
        yield (
            payload,
            base_record(
                spec,
                run_id,
                at,
                payload,
                place_code_raw=code,
                place_code_system="airkorea_station",
                observed_at=end.isoformat(),
                observed_at_source="source",
                observed_period_type="H",
                observed_period_start=(end - timedelta(hours=1)).isoformat(),
                observed_period_end=end.isoformat(),
                geometry=geometry,
                location_precision="exact" if geometry else "none",
                indicator_id=indicator,
                value=value,
                unit=unit,
                missing_reason="not_published" if value is None else None,
                locator={
                    "측정소코드": code,
                    "측정소명": name,
                    "측정일시": raw_time,
                    "column": HEADERS[column],
                },
                dedup_key=f"airkorea_final:{code}:{pollutant}:{raw_time}"
                + (":provisional" if spec.data_status == "provisional" else ""),
            ),
        )


def _month_of(text):
    """`2024년 1월 `(시트) · `2023년 1월.xlsx`(zip 안 파일) → 그 달 1일."""
    month = re.fullmatch(r"([0-9]{4})년\s*([0-9]{1,2})월\s*(?:\.xlsx)?", text)
    return date(int(month[1]), int(month[2]), 1) if month else None


def _in_range(first, spec):
    next_month = date(first.year + (first.month == 12), first.month % 12 + 1, 1)
    return first < spec.end and next_month > spec.start


def _sheet_pairs(sheet, label, spec, run_id, at, stations, progress):
    rows = sheet.iter_rows(values_only=True)
    if tuple(next(rows, ())) not in (HEADERS, SHORT_HEADERS):
        raise CollectionError("AIRKOREA_HEADER_MISMATCH")
    scanned = 1
    for number, cells in enumerate(rows, start=2):
        scanned = number
        if progress and number % 100000 == 0:
            progress(label, number)
        if cells[0] is None and all(c is None for c in cells):
            continue
        # 먼저 지역을 검사해 대상 밖 전국 자료를 값 변환하지 않는다.
        if not isinstance(cells[0], str) or not in_target(cells[0]):
            continue
        yield from measurement_pairs(cells, label, number, spec, run_id, at, stations)
    if progress:
        progress(label, scanned)


def _monthly_zip_pairs(path, spec, run_id, at, stations, progress, selected):
    """2023·2025 형식: zip 안 월별 파일마다 시트 하나(Data)."""
    with zipfile.ZipFile(path) as archive, tempfile.TemporaryDirectory() as work:
        for member in archive.infolist():
            if member.is_dir():
                continue
            first = _month_of(Path(member.filename).name)
            if first is None:
                raise CollectionError("AIRKOREA_UNRECOGNIZED_MEMBER")
            if not _in_range(first, spec):
                continue
            selected.add(first.strftime("%Y-%m"))
            # openpyxl 이 앞뒤로 읽으므로 필요한 달만 임시 파일로 꺼낸다
            local = Path(work) / f"{first:%Y%m}.xlsx"
            with archive.open(member) as src, local.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            book = load_workbook(local, read_only=True, data_only=False)
            try:
                if len(book.worksheets) != 1:
                    raise CollectionError("AIRKOREA_UNRECOGNIZED_SHEET")
                yield from _sheet_pairs(
                    book.worksheets[0], member.filename, spec, run_id, at, stations, progress
                )
            finally:
                book.close()


def workbook_pairs(path: Path, spec, run_id, at, stations=(), progress=None):
    """2024 형식(엑셀 하나, 월별 시트)과 2023·2025 형식(월별 파일 zip)을 읽는다."""
    expected_months = {
        (spec.start + timedelta(days=i)).strftime("%Y-%m")
        for i in range((spec.end - spec.start).days)
    }
    selected_months = set()
    if zipfile.is_zipfile(path) and Path(path).suffix.lower() == ".zip":
        yield from _monthly_zip_pairs(path, spec, run_id, at, stations, progress, selected_months)
    else:
        book = load_workbook(path, read_only=True, data_only=False)
        try:
            for sheet in book:
                first = _month_of(sheet.title)
                if first is None:
                    raise CollectionError("AIRKOREA_UNRECOGNIZED_SHEET")
                if not _in_range(first, spec):
                    continue
                selected_months.add(first.strftime("%Y-%m"))
                yield from _sheet_pairs(sheet, sheet.title, spec, run_id, at, stations, progress)
        finally:
            book.close()
    if selected_months != expected_months:
        raise CollectionError("AIRKOREA_INCOMPLETE_MONTHS")
