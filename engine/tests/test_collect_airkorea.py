"""실제 원천 예시·작은 XLSX·API 모의 응답으로 에어코리아 수집 경계를 확인한다."""

import copy
import json
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

import pytest
from openpyxl import Workbook

from pipeline.collect import airkorea
from pipeline.collect.airkorea import (
    HEADERS,
    AirSpec,
    area_of,
    get_page,
    hour_end,
    measurement_pairs,
    station_pairs,
    station_record,
    workbook_pairs,
)
from pipeline.collect.airkorea_cli import execute, main
from pipeline.collect.kosis import CollectionError
from pipeline.refine.run import refine_records
from tests.test_collect_kosis import MemoryStore

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "contracts/c1/examples/raw"
STATIONS = json.loads((EXAMPLES / "airkorea-station-yeosu.json").read_text("utf-8"))
ROWS = json.loads((EXAMPLES / "airkorea-measure-rows.json").read_text("utf-8"))
AT = "2026-10-23T00:00:00+00:00"
FINAL = AirSpec("final", file_name="한국환경공단_에어코리아_최종확정 측정자료_20241231.xlsx")


def gwangju_station():
    return {
        **STATIONS[1],
        "stationName": "농성동",
        "addr": "광주광역시 서구 경열로",
        "dmX": "35.156",
        "dmY": "126.891",
    }


def create_book(path, rows=ROWS, header=HEADERS, title="2024년 1월 "):
    book = Workbook()
    sheet = book.active
    sheet.title = title
    sheet.append(header)
    for row in rows:
        sheet.append(row)
    book.save(path)
    book.close()


def test_source_station_xy_order_and_p2():
    record = station_record(
        STATIONS[1], AirSpec("stations"), "test", AT, "https://apis.data.go.kr/?serviceKey=<KEY>"
    )
    assert record["geometry"]["coordinates"] == [127.725967, 34.741301]
    assert record["indicator_id"] is None and record["value"] is None
    assert record["license_type"] == "KOGL-3"
    assert refine_records([record])[0]["validation_status"] == "pass"


@pytest.mark.parametrize(
    "field,value",
    [("dmX", "127.72"), ("dmY", "34.74"), ("dmX", "NaN"), ("dmY", ""), ("stationName", "")],
)
def test_bad_station_is_rejected(field, value):
    item = {**STATIONS[1], field: value}
    with pytest.raises(CollectionError, match="INVALID_STATION"):
        station_record(item, AirSpec("stations"), "test", AT, "https://example.org")


@pytest.mark.parametrize(
    "address,area",
    [
        ("전남 여수시 서교1길", "여수"),
        ("전남광주통합특별시 여수시 서교1길", "여수"),
        ("광주광역시 남구 봉선로", "광주"),
        ("광주 북구", "광주"),
        ("전남광주통합특별시 광산구", "광주"),
        ("경기 광주시 초월읍", None),
        ("전남 나주시 광주로", None),
        ("서울 강남구", None),
    ],
)
def test_region_boundaries(address, area):
    assert area_of(address) == area


def test_pagination_filters_gyeonggi_and_integrated_province_overlap():
    calls = []
    outside = {**STATIONS[1], "addr": "경기 광주시 초월읍"}

    def fetch(area, page, key):
        calls.append((area, page))
        if area == "여수":
            return ([STATIONS[0]] if page == 1 else [STATIONS[1]]), 2
        # '광주' 조회에 현재 통합 시도명을 가진 여수도 반환되어도 광주 측정소에 섞지 않는다.
        return [STATIONS[1], outside, gwangju_station()], 3

    pairs = list(station_pairs(AirSpec("stations"), "test", AT, "mock-key", fetch=fetch))
    assert calls == [("여수", 1), ("여수", 2), ("광주", 1)]
    assert [record["place_code_raw"] for _, record in pairs] == ["여수항", "서강동", "농성동"]


def test_incomplete_station_page_never_succeeds():
    def fetch(area, page, key):
        return ([STATIONS[0]] if page == 1 else []), 2

    with pytest.raises(CollectionError, match="INCOMPLETE_RESPONSE"):
        list(station_pairs(AirSpec("stations"), "test", AT, "mock", fetch=fetch))


def test_source_measurements_six_units_hour24_missing_and_p2():
    pairs = [
        pair
        for i, row in enumerate(ROWS)
        for pair in measurement_pairs(row, "2024년 1월 ", i + 2, FINAL, "test", AT)
    ]
    records = [record for _, record in pairs]
    assert len(records) == 18
    pm25 = [r for r in records if r["indicator_id"] == "air_pm25"]
    assert [r["value"] for r in pm25] == [25, None, None]
    assert pm25[2]["observed_at"] == "2024-01-02T00:00:00+09:00"
    assert pm25[2]["observed_period_start"] == "2024-01-01T23:00:00+09:00"
    assert pm25[2]["missing_reason"] == "not_published"
    assert pm25[0]["unit"] == "µg/m³"
    assert records[0]["unit"] == "ppm" and records[0]["value"] == 0.0029
    assert pm25[0]["geometry"] is None  # 현재 좌표를 과거 자료에 자동 부착하지 않는다.
    assert all(r["validation_status"] == "pass" for r in refine_records(records))
    assert len({r["content_hash"] for r in records}) == 18


@pytest.mark.parametrize("value", [2024010100, 2024010125, 2024023001, "2024-01-01 01:00"])
def test_invalid_time_rejected(value):
    with pytest.raises(CollectionError, match="INVALID_HOUR"):
        hour_end(value)


@pytest.mark.parametrize("value", [-1, "-", "NaN", float("inf"), True, "=1+1"])
def test_invalid_pollutant_values_fail_instead_of_becoming_zero(value):
    row = copy.deepcopy(ROWS[0])
    row[10] = value
    with pytest.raises(CollectionError, match="INVALID_VALUE"):
        list(measurement_pairs(row, "2024년 1월 ", 2, FINAL, "test", AT))


def test_zero_is_not_missing():
    row = copy.deepcopy(ROWS[0])
    row[10] = 0
    record = list(measurement_pairs(row, "2024년 1월 ", 2, FINAL, "test", AT))[-1][1]
    assert record["value"] == 0 and record["missing_reason"] is None


def test_real_xlsx_read_path_and_region_filter(tmp_path):
    path = tmp_path / "final.xlsx"
    outside = copy.deepcopy(ROWS[0])
    outside[0] = "경기 광주시"
    create_book(path, [*ROWS, outside])
    pairs = list(workbook_pairs(path, FINAL, "test", AT))
    assert len(pairs) == 18
    assert pairs[0][1]["locator"]["sheet"] == "2024년 1월 "
    assert pairs[0][1]["locator"]["row"] == 2


def test_mismatched_header_and_missing_month_fail(tmp_path):
    path = tmp_path / "bad.xlsx"
    create_book(path, header=("unknown", *HEADERS[1:]))
    with pytest.raises(CollectionError, match="HEADER_MISMATCH"):
        list(workbook_pairs(path, FINAL, "test", AT))
    create_book(path)
    cross_month = AirSpec("final", date(2024, 1, 31), date(2024, 2, 2), "final.xlsx")
    with pytest.raises(CollectionError, match="INCOMPLETE_MONTHS"):
        list(workbook_pairs(path, cross_month, "test", AT))


def test_cli_export_only_needs_no_key_or_db(tmp_path, monkeypatch, capsys):
    import pipeline.collect.airkorea_cli as cli

    def forbidden(*args, **kwargs):
        pytest.fail("file export must not load .env or connect DB")

    monkeypatch.setattr(cli, "dotenv_values", forbidden)
    monkeypatch.setattr(cli.psycopg, "connect", forbidden)
    path, output = tmp_path / "final.xlsx", tmp_path / "c1.json"
    create_book(path)
    assert main(["final", "--xlsx", str(path), "--export-only", "--output", str(output)]) == 0
    assert json.loads(capsys.readouterr().out)["records"] == 18
    assert len(json.loads(output.read_text("utf-8"))) == 18


def test_execute_partial_failure_rolls_back_before_store_save(tmp_path):
    def loader(spec, run, at):
        yield from measurement_pairs(ROWS[0], "2024년 1월 ", 2, spec, run, at)
        raise CollectionError("AIRKOREA_INVALID_VALUE")

    store = MemoryStore()
    with pytest.raises(CollectionError, match="INVALID_VALUE"):
        execute(FINAL, store, tmp_path / "out", loader)
    assert not store.raw
    assert next(iter(store.runs.values()))["status"] == "failed"


def test_api_encoded_key_is_encoded_once_and_not_saved(monkeypatch):
    seen_urls = []

    class Opener:
        @contextmanager
        def open(self, url, timeout):
            seen_urls.append(url)

            class Response:
                def read(self, size):
                    return json.dumps(
                        {
                            "response": {
                                "header": {"resultCode": "00"},
                                "body": {"totalCount": 1, "pageNo": 1, "items": [STATIONS[1]]},
                            }
                        }
                    ).encode()

            yield Response()

    monkeypatch.setattr(airkorea, "build_opener", lambda *args: Opener())
    items, count = get_page("여수", 1, "a%2Bb%2Fc%3D")
    assert count == 1 and items == [STATIONS[1]]
    assert parse_qs(urlsplit(seen_urls[0]).query)["serviceKey"] == ["a+b/c="]


def test_http_exception_does_not_expose_key(monkeypatch):
    class Opener:
        def open(self, *args, **kwargs):
            raise HTTPError("https://example.org?serviceKey=secret", 403, "secret", {}, None)

    monkeypatch.setattr(airkorea, "build_opener", lambda *args: Opener())
    with pytest.raises(CollectionError, match="^AIRKOREA_HTTP_403$"):
        get_page("여수", 1, "secret")
