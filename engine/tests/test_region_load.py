"""region-load 의 행 만들기 (DB 없이). 적재 · 본문 지우기는 tests_postgres/test_region_store.py"""

from pipeline.region.load import event_row, merge_mentions

PUBLISHED = "2025-03-02T09:00:00.000+09:00"


def extracted(**fields):
    return {"id": "n1", "sigungu": "여수시", "summary": " 여수 석유화학 단지의 감산 소식을 전한다. ",
            "event_start": "2025-03-01T00:00:00+09:00", "event_end": "2025-03-02T00:00:00+09:00",
            "time_precision": "day", "mentions": ["울산"]} | fields  # fmt: skip


def test_row_has_regions_from_title_and_location_when_given():
    row, reason = event_row(extracted(), "여수·울산 석화 감산", "본문", PUBLISHED)
    assert reason is None
    assert row["summary"] == "여수 석유화학 단지의 감산 소식을 전한다."
    assert (row["sido"], row["sigun"], row["gu"]) == ("전남광주통합특별시", "여수시", None)
    assert [r["sido"] for r in row["regions"]] == ["전남광주통합특별시", "울산"]
    assert (row["location_precision"], row["place_id"], row["lon"]) == ("none", None, None)

    yeosu = {"place_name": "여수국가산단", "address": "전남광주통합특별시 여수시 …", "lon": 127.7,
             "lat": 34.8, "location_precision": "address", "place_id": "kr-12130560"}  # fmt: skip
    row, reason = event_row(extracted(location=yeosu), "여수 석화 감산", "본문", PUBLISHED)
    assert reason is None and row["place_id"] == "kr-12130560" and row["lat"] == 34.8


def test_out_of_window_falls_back_to_published_day():
    row, _ = event_row(extracted(event_start="2019-05-01T00:00:00+09:00", event_end=None),
                       "제목", "", PUBLISHED)  # fmt: skip
    assert (row["event_start"], row["time_precision"]) == ("2025-03-02T00:00:00+09:00", "published")


def test_held_and_invalid_rows_are_skipped_with_reason():
    assert event_row(extracted(sigungu="보류"), "제목", "", PUBLISHED) == (None, "보류")
    _, reason = event_row(extracted(time_precision="week"), "제목", "", PUBLISHED)
    assert reason == "위반: time_precision=week"


def test_mentions_file_fills_only_rows_without_mentions():
    rows = [{"id": "a"}, {"id": "b", "mentions": ["광주"]}]
    merged = merge_mentions(rows, [{"id": "a", "mentions": ["여수"]}, {"id": "b", "mentions": []}])
    assert [r["mentions"] for r in merged] == [["여수"], ["광주"]]
