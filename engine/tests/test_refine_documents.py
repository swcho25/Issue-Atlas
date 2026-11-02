"""문서(기사) 레코드 정제: 본문 저장 범위 · 같은 기사 대표 1건 · 빈 지명 (S15P31C108-122)."""

import copy

import pytest

from pipeline.refine import refine_record, refine_records
from pipeline.refine.schema import schema_issues
from pipeline.refine.storage import apply_storage_scope
from tests.samples import HASH, KOSIS, NEWS


def news(n=0, **changes):
    record = {
        **copy.deepcopy(NEWS[0]),
        "content_hash": f"sha256:{n:064x}",
        "license_type": "BIGKINDS-이용약관",
        **changes,
    }
    return record


def failed(n=1, status="NO_BODY", **changes):
    # 같은 기사를 받았는데 원문 페이지에서 본문을 못 찾은 판 (수집기 MR !42 모양)
    record = news(n, storage_scope="metadata", **changes)
    record["dedup_key"] = f"bigkinds:synthetic-example-001:{status}"
    record["document"].update(body=None)
    record["document"]["fetch"].update(status=status)
    return record


def discarded(n=2, **changes):
    # 본문을 받아 P3 가 요약한 뒤 본문을 지운 판 (대표 결정 2026-11-01)
    record = news(n, storage_scope="metadata", **changes)
    record["dedup_key"] = "bigkinds:synthetic-example-001:ok"
    record["document"].update(body=None)
    return record


def ok(n=0, **changes):
    record = news(n, **changes)
    record["dedup_key"] = "bigkinds:synthetic-example-001:ok"
    return record


def issue(code, field):
    return {"code": code, "field": field}


def c1_part(out, record):
    return {k: out[k] for k in record}


def test_bigkinds_article_with_body_keeps_full_scope_and_body():
    record = news()

    out = refine_record(record)

    assert out["validation_status"] == "pass"
    assert out["storage_scope"] == "full"
    assert out["document"]["body"] == record["document"]["body"]
    assert schema_issues(c1_part(out, record)) == []


def test_document_below_full_loses_its_body():
    # KOGL-4 는 metadata 까지라 본문을 남기지 않는다. 표시(범위)와 실제(본문)가 어긋나지 않게
    record = news(license_type="KOGL-4")

    out = refine_record(record)

    assert out["validation_status"] == "fixed"
    assert out["issues"] == [
        issue("SCOPE_DOWNGRADED", "storage_scope"),
        issue("BODY_STRIPPED_BY_SCOPE", "document"),
    ]
    assert out["storage_scope"] == "metadata"
    assert out["document"]["body"] is None
    assert record["document"]["body"] is not None  # 입력은 그대로
    assert schema_issues(c1_part(out, record)) == []


def test_body_limit_comes_from_table():
    out, issues = apply_storage_scope(news(), {"BIGKINDS-이용약관": "link_only"})

    assert out["storage_scope"] == "link_only"
    assert out["document"]["body"] is None
    assert issues == [
        issue("SCOPE_DOWNGRADED", "storage_scope"),
        issue("BODY_STRIPPED_BY_SCOPE", "document"),
    ]


def test_document_without_body_has_nothing_to_strip():
    out = refine_record(failed(license_type="KOGL-4"))

    assert out["validation_status"] == "pass"
    assert out["document"]["body"] is None


def test_same_article_gets_one_obs_key_and_other_articles_another():
    first, again, other = (
        refine_record(r)
        for r in (ok(), failed(), news(2, locator={"news_id": "synthetic-example-002"}))
    )

    assert first["obs_key"] is not None
    assert first["obs_key"] == again["obs_key"]
    assert first["obs_key"] != other["obs_key"]


@pytest.mark.parametrize("ok_first", [True, False])
def test_fetched_body_wins_over_a_later_failure(ok_first):
    # 성공한 뒤 다시 받아 실패한 판이 더 늦어도 본문 있는 판이 대표다
    records = [ok(), failed(collected_at="2026-10-27T00:00:00Z")]
    if not ok_first:
        records.reverse()

    out = refine_records(records)

    latest = [r for r in out if r["is_latest"]]
    assert [r["document"]["fetch"]["status"] for r in latest] == ["ok"]
    assert sum(r["is_latest"] is False for r in out) == 1


def test_later_success_replaces_an_earlier_failure():
    out = refine_records([failed(), ok(collected_at="2026-10-27T00:00:00Z")])

    assert [(r["document"]["fetch"]["status"], r["is_latest"]) for r in out] == [
        ("NO_BODY", False),
        ("ok", True),
    ]


def test_article_without_body_is_held():
    # 본문을 허락하는 기사인데 본문을 못 받았다(원문 링크 없음 · robots 차단 등)
    out = refine_record(failed())

    assert out["validation_status"] == "held"
    assert out["issues"] == [issue("BODY_MISSING", "document")]


def test_article_whose_body_was_discarded_after_summary_passes():
    record = discarded()

    out = refine_record(record)

    assert out["validation_status"] == "pass"
    assert out["issues"] == []
    assert (out["storage_scope"], out["document"]["body"]) == ("metadata", None)
    assert out["document"]["fetch"]["status"] == "ok"
    assert schema_issues(c1_part(out, record)) == []


def test_discarded_article_wins_over_a_later_failure():
    out = refine_records([discarded(), failed(collected_at="2026-10-27T00:00:00Z")])

    assert [(r["document"]["fetch"]["status"], r["is_latest"]) for r in out] == [
        ("ok", True),
        ("NO_BODY", False),
    ]


def test_article_that_never_got_a_body_is_not_ready():
    out = refine_records(
        [failed(1, "NO_BODY"), failed(2, "HTTP_ERROR", collected_at="2026-10-27T00:00:00Z")]
    )

    assert [(r["validation_status"], r["is_latest"]) for r in out] == [
        ("held", False),
        ("held", False),
    ]


def test_press_release_without_body_is_not_held():
    # 본문 필수는 기사(news)만. 보도자료는 목록 정보만으로도 넘긴다
    record = failed(license_type="KOGL-1")
    record["document"]["kind"] = "press_release"

    out = refine_record(record)

    assert out["validation_status"] == "pass"


def test_source_text_document_may_have_an_empty_place():
    out = refine_record(news(place_code_raw=""))

    assert out["validation_status"] == "pass"
    assert out["place_code_raw"] == ""


def test_source_text_document_still_needs_the_place_key():
    out = refine_record(news(place_code_raw=None))

    assert issue("MISSING_REQUIRED", "place_code_raw") in out["issues"]


def test_observation_with_an_empty_place_is_still_missing():
    record = {**copy.deepcopy(KOSIS[0]), "content_hash": HASH, "place_code_raw": ""}

    out = refine_record(record)

    assert out["issues"] == [issue("MISSING_REQUIRED", "place_code_raw")]
