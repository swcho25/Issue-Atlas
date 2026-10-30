"""온통청년 청년정책 → C1 정책 레코드. 가상 응답, 네트워크 없음."""

import pytest

from pipeline.collect import youth_policy
from pipeline.collect.kosis import CollectionError
from pipeline.collect.youth_policy import PolicyQuery, collect, parse_page, search, to_record
from pipeline.refine.validate import validate
from tests.test_c1_document import validator

AT = "2026-10-29T00:00:00+00:00"


def policy(no, **changes):
    return {
        "plcyNo": no,
        "plcyNm": f"가상시 청년 월세 지원 {no}",
        "plcyKywdNm": "주거지원, 월세,",
        "plcyExplnCn": " 청년 월세를 지원합니다 ",
        "lclsfNm": "주거",
        "mclsfNm": "주거비 지원",
        "sprvsnInstCdNm": "가상시",
        "zipCd": "12130,12210",
        "bizPrdBgngYmd": "20250101",
        "bizPrdEndYmd": "20251231",
        "frstRegDt": "2025-03-04 10:00:00",
        "lastMdfcnDt": "2025-03-05 11:00:00",
        "inqCnt": 10,
    } | changes


class Api:
    """지역 → 정책 목록. (지역, 쪽) 호출을 남긴다."""

    def __init__(self, by_region):
        self.by_region, self.calls = by_region, []

    def __call__(self, region, page, api_key):
        self.calls.append((region, page))
        rows = self.by_region.get(region, [])
        size = youth_policy.PAGE_SIZE
        return rows[(page - 1) * size : page * size], len(rows)


class MemoryStore:
    def __init__(self):
        self.raw, self.runs = {}, {}

    def start(self, query, run_id, at):
        self.runs[run_id] = {"status": None}

    def save(self, rows, records):
        new = [r for r in records if r["content_hash"] not in self.raw]
        self.raw |= {r["content_hash"]: (row, r) for row, r in zip(rows, records, strict=True)}
        return len(new)

    def finish(self, run_id, status, stats):
        self.runs[run_id] = {"status": status, **stats}


def test_search_pages_each_region_and_waits_between_calls(monkeypatch):
    monkeypatch.setattr(youth_policy, "PAGE_SIZE", 2)
    api = Api({"12130": [policy("A"), policy("B"), policy("C")], "12210": [policy("A")]})
    waits = []
    found, calls = search(PolicyQuery(("12130", "12210")), "key", api, waits.append)
    # 여수는 2쪽(2 + 1), 광주 동구는 1쪽. 같은 정책도 지역마다 한 줄
    assert api.calls == [("12130", 1), ("12130", 2), ("12210", 1)]
    assert [(row["plcyNo"], region) for row, region in found] == [
        ("A", "12130"),
        ("B", "12130"),
        ("C", "12130"),
        ("A", "12210"),
    ]
    assert (calls, waits) == (3, [youth_policy.INTERVAL] * 2)


def test_rate_limit_is_retried_but_other_errors_stop():
    api = Api({"12130": [policy("A")]})
    failures = iter(
        [CollectionError("YOUTHCENTER_HTTP_403"), CollectionError("YOUTHCENTER_HTTP_502")]
    )

    def flaky(region, page, key):
        failure = next(failures, None)
        if failure:
            raise failure
        return api(region, page, key)

    waits = []
    found, calls = search(PolicyQuery(("12130",)), "k", flaky, waits.append)
    assert (len(found), calls) == (1, 3)
    # 요청 사이 1초 + 다시 부르기 전 10초 · 20초
    assert waits == [youth_policy.RETRY_WAIT, 1.0, youth_policy.RETRY_WAIT * 2, 1.0]

    def broken(region, page, key):
        raise CollectionError("YOUTHCENTER_HTTP_401")

    with pytest.raises(CollectionError, match="^YOUTHCENTER_HTTP_401$"):
        search(PolicyQuery(("12130",)), "k", broken, lambda _: None)


def test_record_is_valid_c1_policy_with_raw_row_in_payload():
    payload, record = to_record(policy("A"), "12130", "youthcenter_x", AT)
    assert validate(record) == []
    validator().validate(record)
    assert payload == {"youthcenter": policy("A"), "zipCd": "12130"}
    assert (record["place_code_raw"], record["place_code_system"]) == ("12130", "bjd")
    assert record["published_at"] == "2025-03-04T10:00:00+09:00"
    assert record["dedup_key"] == "youthcenter:A:12130"
    assert record["storage_scope"] == "metadata"
    document = record["document"]
    assert document["kind"] == "policy"
    assert document["publisher"] == "가상시"
    assert document["categories"] == ["주거", "주거비 지원"]
    assert document["keywords"] == ["월세", "주거지원"]
    assert document["excerpt"] == "청년 월세를 지원합니다"
    assert (document["link"], document["fetch"], document["body"]) == (None, None, None)


def test_same_policy_is_same_raw_but_edited_policy_is_new_version():
    first = to_record(policy("A"), "12130", "r1", AT)[1]
    viewed = to_record(policy("A", inqCnt=99), "12130", "r2", AT)[1]
    reordered = to_record(policy("A", plcyKywdNm="월세,주거지원"), "12130", "r4", AT)[1]
    edited = to_record(policy("A", lastMdfcnDt="2025-04-01 09:00:00"), "12130", "r3", AT)[1]
    other_region = to_record(policy("A"), "12210", "r1", AT)[1]
    assert first["content_hash"] == viewed["content_hash"]
    # 키워드 순서만 바뀐 응답도 같은 원본(실호출에서 부를 때마다 순서가 바뀌었다)
    assert first["content_hash"] == reordered["content_hash"]
    assert first["content_hash"] != edited["content_hash"]
    assert first["dedup_key"] == edited["dedup_key"]
    assert first["content_hash"] != other_region["content_hash"]


def test_missing_optional_fields_stay_empty_and_date_falls_back_to_last_edit():
    row = policy("A", sprvsnInstCdNm=" ", plcyKywdNm=None, plcyExplnCn="", frstRegDt="미상")
    record = to_record(row, "12130", "r", AT)[1]
    assert validate(record) == []
    document = record["document"]
    assert (document["publisher"], document["keywords"], document["excerpt"]) == (None, [], None)
    assert record["published_at"] == "2025-03-05T11:00:00+09:00"


def test_policy_without_any_date_is_counted_not_saved():
    store = MemoryStore()
    undated = policy("B", frstRegDt=None, lastMdfcnDt="")
    api = Api({"12130": [policy("A"), undated]})
    result = collect(PolicyQuery(("12130",)), "k", store, fetch=api, sleep=lambda _: None)
    assert (result["received"], result["inserted"], result["no_published_at"]) == (2, 1, 1)


@pytest.mark.parametrize(
    "data,code",
    [
        ({"resultCode": 500, "result": {}}, "YOUTHCENTER_API_ERROR"),
        ({"result": {"youthPolicyList": "x"}}, "YOUTHCENTER_INVALID_RESPONSE"),
        (
            {"result": {"youthPolicyList": [], "pagging": {"totCount": "3"}}},
            "YOUTHCENTER_INVALID_RESPONSE",
        ),
        ({"resultMessage": "bad key secret-key"}, "YOUTHCENTER_SECRET_IN_RESPONSE"),
        ([], "YOUTHCENTER_INVALID_RESPONSE"),
    ],
)
def test_bad_responses_stop_with_fixed_code(data, code):
    with pytest.raises(CollectionError, match=f"^{code}$"):
        parse_page(data, "secret-key")


def test_page_shape():
    data = {
        "resultCode": 200,
        "result": {"pagging": {"totCount": 1}, "youthPolicyList": [policy("A")]},
    }
    assert parse_page(data, "k") == ([policy("A")], 1)
    assert parse_page({"result": {"pagging": {"totCount": 0}}}, "k") == ([], 0)


def test_invalid_policy_and_missing_key_fail_the_run():
    store = MemoryStore()
    with pytest.raises(CollectionError, match="^YOUTHCENTER_KEY_MISSING$"):
        collect(PolicyQuery(), "", store, fetch=Api({}), sleep=lambda _: None)
    api = Api({"12130": [policy("A", plcyNm=" ")]})
    with pytest.raises(CollectionError, match="^YOUTHCENTER_INVALID_POLICY$"):
        collect(PolicyQuery(("12130",)), "k", store, fetch=api, sleep=lambda _: None)
    assert [run["status"] for run in store.runs.values()] == ["failed", "failed"]
    assert [run["error_code"] for run in store.runs.values()] == [
        "YOUTHCENTER_KEY_MISSING",
        "YOUTHCENTER_INVALID_POLICY",
    ]


def test_collect_twice_saves_once():
    store = MemoryStore()
    api = Api({"12130": [policy("A"), policy("B")], "12210": [policy("A")]})
    query = PolicyQuery(("12130", "12210"))
    first = collect(query, "k", store, fetch=api, sleep=lambda _: None)
    second = collect(query, "k", store, fetch=api, sleep=lambda _: None)
    assert (first["received"], first["inserted"], first["duplicates"]) == (3, 3, 0)
    assert (second["inserted"], second["duplicates"]) == (0, 3)
    assert first["regions"] == ["12130", "12210"]
