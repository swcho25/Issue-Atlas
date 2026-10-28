"""문서 계약과 관측값 계약의 경계. 기업 API 실호출·이용허락 판정은 하지 않는다."""

import copy

import pytest
from jsonschema import Draft202012Validator

from pipeline.refine.schema import load_c1_schema
from tests.samples import P1_SAMPLES, load


def validator():
    schema = load_c1_schema()
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def test_existing_observations_and_synthetic_news_pass():
    for record in [*P1_SAMPLES, load("bigkinds-news")]:
        validator().validate(record)


@pytest.mark.parametrize(
    "changes",
    [
        {"published_at": None},
        {"raw_url": None, "file_name": "news.json"},
        {"raw_url": "file:///local/news"},
        {"value": 1},
        {"indicator_id": "population_net_migration"},
    ],
)
def test_news_cannot_be_observation_or_lose_provenance(changes):
    assert not validator().is_valid(load("bigkinds-news") | changes)


@pytest.mark.parametrize("field", ["title", "entities", "excerpt", "link", "fetch", "body"])
def test_document_fields_are_required(field):
    record = load("bigkinds-news")
    del record["document"][field]
    assert not validator().is_valid(record)


def test_news_cannot_store_excerpt_or_unrecognized_content():
    for field in ("excerpt", "content"):
        record = load("bigkinds-news")
        record["document"][field] = "본문"
        assert not validator().is_valid(record)


def test_press_release_excerpt_requires_metadata_scope():
    record = load("bigkinds-news")
    record["document"].update(kind="press_release", excerpt="허용된 보도자료 앞부분")
    validator().validate(record)
    record["storage_scope"] = "link_only"
    assert not validator().is_valid(record)


def test_source_text_is_not_an_observation_code_system():
    record = copy.deepcopy(P1_SAMPLES[0])
    record["place_code_system"] = "source_text"
    assert not validator().is_valid(record)


def metadata_only(record, status="NO_LINK"):
    record["storage_scope"] = "metadata"
    record["document"].update(body=None, link=None)
    record["document"]["fetch"].update(status=status, http_status=None, fetched_at=None)
    return record


def test_body_only_with_ok_fetch_and_full_scope():
    validator().validate(metadata_only(load("bigkinds-news")))
    no_fetch = metadata_only(load("bigkinds-news"))
    no_fetch["document"]["fetch"] = None  # 본문 수집을 시도하지 않은 문서(보도자료 목록 등)
    validator().validate(no_fetch)
    body_without_full = load("bigkinds-news") | {"storage_scope": "metadata"}
    assert not validator().is_valid(body_without_full)
    full_without_body = metadata_only(load("bigkinds-news")) | {"storage_scope": "full"}
    assert not validator().is_valid(full_without_body)
    failed_but_full = load("bigkinds-news")
    failed_but_full["document"]["fetch"]["status"] = "CONTENT_MISMATCH"
    assert not validator().is_valid(failed_but_full)


@pytest.mark.parametrize(
    "path,value",
    [
        (("link",), "news.example.com/article/1"),
        (("fetch", "status"), "TIMEOUT"),
        (("fetch", "http_status"), 99),
        (("fetch", "fetched_at"), "yesterday"),
        (("fetch", "extra"), 1),
    ],
)
def test_fetch_result_shape(path, value):
    record = load("bigkinds-news")
    target = record["document"]
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    assert not validator().is_valid(record)
