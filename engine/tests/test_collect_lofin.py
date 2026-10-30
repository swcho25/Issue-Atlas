"""지방재정365 세부사업별 세출현황 → local_expenditure 레코드. 실제 파일과 같은 모양의 작은 가상 XLSX."""

import json

import openpyxl
import pytest

from pipeline.collect.kosis import CollectionError
from pipeline.collect.lofin import HEADER, main, read_rows

NOW = "2026-10-29T00:00:00Z"


def row(region, gov, name, total=1000, spent=900, account="일반회계"):
    balance = total - spent if isinstance(total, int | float) else 0
    return (region, gov, account, name, total, 0, 0, total, 0, spent, balance, "환경", "대기")


def book(path, rows, year="2025", header=HEADER, extra_sheet=False):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = year
    ws.append(("단위:원",) + (None,) * 12)
    for line in header:
        ws.append(line)
    for r in rows:
        ws.append(r)
    if extra_sheet:
        wb.create_sheet("메모")
    wb.save(path)
    return path


def test_keeps_only_target_governments_with_codes(tmp_path):
    path = book(
        tmp_path / "2025_세부사업별세출현황.xlsx",
        [
            row("서울", "본청", "서울 사업"),
            row("광주", "본청", " 미세먼지 저감 "),
            row("광주", "광산구", "청년 월세 지원", total=2.0e3, spent=1.5e3),
            row("전남", "여수시", "청년 정착 지원"),
            row("전남", "순천시", "다른 시 사업"),
        ],
    )
    records, counts = read_rows(path, NOW)
    assert counts == {"scanned": 5, "matched": 3, "same_row": 0}
    by_name = {r["project_name"]: r for r in records}
    assert set(by_name) == {"미세먼지 저감", "청년 월세 지원", "청년 정착 지원"}
    assert by_name["미세먼지 저감"]["place_code_raw"] == "29"
    assert by_name["청년 정착 지원"]["place_code_raw"] == "46130"
    youth = by_name["청년 월세 지원"]
    assert (youth["place_code_raw"], youth["fiscal_year"]) == ("29200", 2025)
    assert (youth["budget_total"], youth["expenditure"], youth["balance"]) == (2000, 1500, 500)
    assert (youth["field"], youth["sector"], youth["storage_scope"]) == ("환경", "대기", "full")
    assert youth["file_name"] == "2025_세부사업별세출현황.xlsx"


def test_identical_rows_are_one_record_and_reading_again_gives_same_ids(tmp_path):
    path = book(
        tmp_path / "a.xlsx",
        [
            row("광주", "동구", "같은 사업"),
            row("광주", "동구", "같은 사업"),
            row("광주", "동구", "같은 사업", spent=1),
        ],
    )
    records, counts = read_rows(path, NOW)
    assert (len(records), counts["same_row"]) == (2, 1)
    again, _ = read_rows(path, "2026-11-01T00:00:00Z")
    assert {r["expenditure_id"] for r in records} == {r["expenditure_id"] for r in again}


@pytest.mark.parametrize(
    "kwargs,rows,code",
    [
        (
            {"header": (HEADER[0], HEADER[1][:4] + ("합계",) + HEADER[1][5:])},
            [],
            "LOFIN_HEADER_CHANGED",
        ),
        ({"extra_sheet": True}, [row("광주", "동구", "x")], "LOFIN_UNEXPECTED_SHEETS"),
        ({"year": "세출"}, [row("광주", "동구", "x")], "LOFIN_UNEXPECTED_SHEETS"),
        ({}, [row("서울", "본청", "x")], "LOFIN_NO_ROWS"),
        ({}, [row("광주", "동구", "x", total="1,000")], "LOFIN_INVALID_ROW"),
        ({}, [row("광주", "동구", "x", total=10.5)], "LOFIN_INVALID_ROW"),
        ({}, [row("광주", "동구", " ")], "LOFIN_INVALID_ROW"),
    ],
)
def test_unexpected_files_stop_with_fixed_code(tmp_path, kwargs, rows, code):
    path = book(tmp_path / "x.xlsx", rows, **kwargs)
    with pytest.raises(CollectionError, match=f"^{code}$"):
        read_rows(path, NOW)


def test_cli_output_file_replaces_stdout(tmp_path, capsysbinary):
    path = book(tmp_path / "z.xlsx", [row("광주", "서구", "청년 공간")])
    out_file = tmp_path / "c1.json"
    assert main(["--xlsx", str(path), "--output", str(out_file)]) == 0
    out, err = capsysbinary.readouterr()
    assert out == b"" and json.loads(err)["records"] == 1
    [line] = out_file.read_bytes().splitlines()
    assert json.loads(line)["place_code_raw"] == "29140"


def test_cli_prints_jsonl_without_db(tmp_path, capsysbinary):
    path = book(tmp_path / "y.xlsx", [row("전남", "여수시", "청년 정착 지원")])

    def forbidden():
        pytest.fail("--db 없이 DB 에 연결하면 안 된다")

    assert main(["--xlsx", str(path)], connect=forbidden) == 0
    out, err = capsysbinary.readouterr()
    [line] = out.decode().splitlines()
    assert json.loads(line)["project_name"] == "청년 정착 지원"
    assert json.loads(err)["records"] == 1
