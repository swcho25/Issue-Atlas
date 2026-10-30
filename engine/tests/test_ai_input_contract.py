"""AI 모듈 입력 계약(contracts/ai). 가상 예시는 스키마를 통과하고, 계약을 어긴 입력은 실패한다.

판정 입력은 C2 스키마를 $ref 로 쓰므로 C2 스키마도 함께 등록한다.
"""

import copy
import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
AI = CONTRACTS / "ai"
EXAMPLES = AI / "examples"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def example(name):
    return read(EXAMPLES / f"{name}.json")


SCHEMAS = [read(p) for p in [*(CONTRACTS / "c2/schemas").glob("*.json"), *AI.glob("*.json")]]
REGISTRY = Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in SCHEMAS)


def validator(name):
    schema = read(AI / f"{name}.schema.json")
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(
        schema, registry=REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER
    )


DOCS = sorted(p.stem for p in EXAMPLES.glob("doc-*.json"))
JUDGMENTS = sorted(p.stem for p in EXAMPLES.glob("judgment-*.json"))
STATUSES = sorted(p.stem for p in EXAMPLES.glob("status-*.json"))


def test_examples_cover_every_case():
    assert len(DOCS) == 4
    assert {example(n)["claim"]["value"] for n in JUDGMENTS} == {
        "increasing",
        "insufficient",
        "not_comparable",
    }
    assert {example(n)["status"] for n in STATUSES} == {"done", "waiting_input", "failed"}


@pytest.mark.parametrize(
    ("schema", "name"),
    [
        *(("document-input", n) for n in DOCS),
        *(("judgment-input", n) for n in JUDGMENTS),
        *(("status", n) for n in STATUSES),
    ],
)
def test_fixture_examples_pass_and_say_they_are_fixtures(schema, name):
    record = example(name)
    validator(schema).validate(record)
    assert record["fixture"] is True


# 판정 입력의 판정 칸은 C2 예시를 그대로 옮긴 것이다. C2 가 바뀌면 같이 고친다
C2_SOURCE = {
    "judgment-ready": "argument-c1-ready",
    "judgment-insufficient": "argument-c1-insufficient",
    "judgment-not-comparable": "argument-a3-not-comparable",
}
C2_FIELDS = (
    "run_id",
    "question",
    "card_version",
    "formula_version",
    "taxonomy_version",
    "run_status",
    "evidence_table",
    "comparability",
    "claim",
    "qualifier",
    "data",
    "warrant",
    "ceiling",
)


@pytest.mark.parametrize("name", JUDGMENTS)
def test_judgment_examples_keep_c2_values(name):
    argument = read(CONTRACTS / "c2/examples" / f"{C2_SOURCE[name]}.json")
    record = example(name)
    assert {k: record[k] for k in C2_FIELDS} == {k: argument[k] for k in C2_FIELDS}


def doc(name="doc-news-confirmed", **changes):
    record = copy.deepcopy(example(name))
    for path, value in changes.items():
        *parents, key = path.split("__")
        target = record
        for parent in parents:
            target = target[int(parent)] if parent.isdigit() else target[parent]
        target[key] = value
    return record


@pytest.mark.parametrize(
    ("name", "changes"),
    [
        # 본문은 full 일 때만
        ("doc-news-confirmed", {"usage__storage_scope": "metadata"}),
        ("doc-press-metadata", {"content__body": "본문"}),
        ("doc-news-confirmed", {"content__body": None}),
        # 뉴스 · link_only 는 앞부분이 없다
        ("doc-news-confirmed", {"content__excerpt": "앞부분"}),
        # 추출 전이면 사건 기간 · 요약 · 추출 판 · P3 지역이 없다
        (
            "doc-press-metadata",
            {
                "event_period": {
                    "start": "2026-10-29T00:00:00+09:00",
                    "end": None,
                    "precision": "day",
                }
            },
        ),
        ("doc-press-metadata", {"content__summary": "요약"}),
        ("doc-press-metadata", {"version__extraction_version": "p3"}),
        (
            "doc-news-confirmed",
            {
                "extraction_status": "pending",
                "content__summary": None,
                "event_period": None,
                "version__extraction_version": None,
            },
        ),
        # 추출이 끝났으면 P3 지역이 하나 있다 (여러 지역 글은 P3 가 넓은 단위 하나로 낸다)
        ("doc-news-confirmed", {"regions": []}),
        (
            "doc-news-confirmed",
            {
                "regions": [
                    {
                        "sido": "전남광주통합특별시",
                        "sigun": sigun,
                        "gu": None,
                        "place_id": None,
                        "raw": None,
                        "source": "extraction",
                        "status": "confirmed",
                    }
                    for sigun in ("여수시", "광주")
                ]
            },
        ),
        # 확정은 P3 지역만, P3 지역은 시도가 있다, 힌트는 원천 값을 남긴다
        ("doc-press-metadata", {"regions__0__status": "confirmed"}),
        ("doc-news-confirmed", {"regions__0__sido": None}),
        ("doc-news-region-candidate", {"regions__1__raw": None}),
        # 사건 기간은 P3 정밀도 중 published 를 받지 않는다 (그때는 event_period = null)
        ("doc-news-confirmed", {"event_period__precision": "published"}),
        # 가상 자료는 제목에 [fixture]
        ("doc-news-confirmed", {"content__title": "여수시 청년 정착 지원 설명회 열려"}),
        ("doc-news-confirmed", {"doc_id": "fixture-news-0001"}),
        ("doc-news-confirmed", {"score": 0.82}),
    ],
)
def test_document_input_rejects_contract_breaks(name, changes):
    assert not validator("document-input").is_valid(doc(name, **changes))


@pytest.mark.parametrize(
    "field", ["fixture", "version", "regions", "event_period", "extraction_status"]
)
def test_document_input_fields_are_required(field):
    record = example("doc-news-confirmed")
    del record[field]
    assert not validator("document-input").is_valid(record)


def test_real_document_does_not_need_fixture_title():
    record = doc(fixture=False, content__title="여수시 청년 정착 지원 설명회 열려")
    validator("document-input").validate(record)


def judgment(name, **changes):
    return doc(name, **changes)


@pytest.mark.parametrize(
    ("name", "changes"),
    [
        ("judgment-ready", {"score": 1}),
        ("judgment-ready", {"qualifier__confidence": 0.82}),
        # C2 규칙: blocked 면 insufficient, 비교 조건이 하나라도 false 면 증가 · 감소 불가
        ("judgment-insufficient", {"claim__value": "increasing"}),
        ("judgment-not-comparable", {"claim__value": "increasing"}),
        # C2 근거 충실도 규칙표: 구성 값은 그대로 두고 등급만 바꾸면 실패
        ("judgment-ready", {"qualifier__grade": "low"}),
        # 결측은 값 null + 사유, 값이 있으면 사유 없음
        ("judgment-ready", {"statistics_points__0__value": None}),
        ("judgment-ready", {"statistics_points__0__missing_reason": "not_published"}),
        ("judgment-ready", {"rebuttal_candidates__0__decided_by_rule": "maybe"}),
    ],
)
def test_judgment_input_rejects_contract_breaks(name, changes):
    assert not validator("judgment-input").is_valid(judgment(name, **changes))


@pytest.mark.parametrize(
    ("name", "changes"),
    [
        ("status-done", {"reason_code": "LLM_ERROR"}),
        ("status-done", {"output": None}),
        ("status-waiting-input", {"reason_code": "LLM_ERROR"}),
        ("status-waiting-input", {"retryable": False}),
        ("status-failed", {"reason_code": None}),
        ("status-failed", {"output": {}}),
        ("status-failed", {"status": "skipped"}),
    ],
)
def test_status_rejects_contract_breaks(name, changes):
    assert not validator("status").is_valid(doc(name, **changes))


DOC_ID = re.compile(read(AI / "document-input.schema.json")["properties"]["doc_id"]["pattern"])


@pytest.mark.parametrize(
    ("name", "count"), [("real-article-requests", 10), ("metadata-document-requests", 5)]
)
def test_sample_requests_are_real_documents_without_body(name, count):
    samples = read(AI / "samples" / f"{name}.json")
    assert samples["fixture"] is False
    assert samples["body_included"] is False
    items = samples["items"]
    assert len(items) == count
    assert len({item["doc_id"] for item in items}) == count
    for item in items:
        assert DOC_ID.fullmatch(item["doc_id"])
        assert not {"body", "text", "content"} & item.keys()
        assert not item["title"].startswith("[fixture]")
