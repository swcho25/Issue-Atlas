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
        {"storage_scope": "full"},
        {"published_at": None},
        {"raw_url": None, "file_name": "news.json"},
        {"raw_url": "file:///local/news"},
        {"value": 1},
        {"indicator_id": "population_net_migration"},
    ],
)
def test_news_cannot_be_observation_or_lose_provenance(changes):
    assert not validator().is_valid(load("bigkinds-news") | changes)


@pytest.mark.parametrize("field", ["title", "entities", "excerpt"])
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
