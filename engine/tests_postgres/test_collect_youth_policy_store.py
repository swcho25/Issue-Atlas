"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

온통청년 정책을 raw_record(V0002) + 장부(V0005)에 저장하고, P2 가 장부를 읽는다.
"""

import pytest

from pipeline.collect.store import PostgresStore
from pipeline.collect.youth_policy import PolicyQuery, collect
from pipeline.refine.store import refine_raw
from tests.test_collect_youth_policy import Api, policy
from tests_postgres.conftest import fresh_schema

QUERY = PolicyQuery(("12130", "12210"))


@pytest.fixture
def policy_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
        ),
    )


def test_policies_are_raw_rows_with_ledger_and_rerun_adds_nothing(policy_db):
    conn, _ = policy_db
    store = PostgresStore(conn)
    api = Api({"12130": [policy("A"), policy("B")], "12210": [policy("A")]})
    first = collect(QUERY, "key", store, fetch=api, sleep=lambda _: None)
    assert (first["inserted"], first["duplicates"]) == (3, 0)
    rows = conn.execute(
        "SELECT c1_record->>'place_code_raw', c1_record->'document'->>'kind',"
        " payload->'youthcenter'->>'plcyNo', c1_record->>'content_hash' = content_hash"
        " FROM raw_record ORDER BY 3, 1"
    ).fetchall()
    assert rows == [
        ("12130", "policy", "A", True),
        ("12210", "policy", "A", True),
        ("12130", "policy", "B", True),
    ]
    assert conn.execute("SELECT storage_scope FROM source").fetchone() == ("metadata",)
    assert conn.execute("SELECT evidence_class FROM source_spec").fetchone() == (
        "existing_responses",
    )

    second = collect(QUERY, "key", store, fetch=api, sleep=lambda _: None)
    assert (second["inserted"], second["duplicates"]) == (0, 3)

    # 이용허락 표가 full 이고 레코드는 metadata 라 min 규칙으로 metadata 그대로 통과한다
    result = refine_raw(conn)
    assert result["raw"] == 3 and not result["skipped"]
    assert result["status"] == {"pass": 3}


def test_edited_policy_is_next_version_and_only_it_is_ready(policy_db):
    # 정책 내용이 바뀌어 다시 받으면 새 원본 · 새 판. 둘 다 pass, 다음 단계에는 수정본만
    conn, _ = policy_db
    store = PostgresStore(conn)
    query = PolicyQuery(("12130",))
    collect(query, "key", store, fetch=Api({"12130": [policy("A")]}), sleep=lambda _: None)
    edited = policy("A", plcyExplnCn="월세 지원 대상을 넓혔습니다", lastMdfcnDt="2026-10-30")
    second = collect(query, "key", store, fetch=Api({"12130": [edited]}), sleep=lambda _: None)
    assert (second["inserted"], second["duplicates"]) == (1, 0)

    result = refine_raw(conn)
    assert result["status"] == {"pass": 2}
    ready = conn.execute("SELECT record->'document'->>'excerpt' FROM normalized_ready").fetchall()
    assert ready == [("월세 지원 대상을 넓혔습니다",)]
