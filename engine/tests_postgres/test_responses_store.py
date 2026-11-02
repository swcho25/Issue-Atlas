"""명시 실행: uv --directory engine run pytest tests_postgres (Docker 필요).

정제된 온통청년 정책 · local_expenditure → existing_response(V0022). 원천은 고치지 않는다.
"""

import hashlib

import psycopg
import pytest

from pipeline.collect.lofin import store as store_expenditure
from pipeline.collect.store import PostgresStore
from pipeline.collect.youth_policy import PolicyQuery, collect
from pipeline.refine.store import refine_raw
from pipeline.responses.extract import extract
from tests.test_collect_youth_policy import Api, policy
from tests_postgres.conftest import fresh_schema

YEOSU = "전남광주통합특별시 여수시 기획경제국"


@pytest.fixture
def responses_db(postgis):
    yield from fresh_schema(
        postgis,
        (
            "V0002__collection_place_foundation.sql",
            "V0005__create_normalized_record.sql",
            "V0008__create_air_monthly.sql",
            "V0009__store_air_monthly_only.sql",
            "V0011__seed_places.sql",
            "V0013__create_card_catalog.sql",
            "V0015__create_local_expenditure.sql",
            "V0022__create_existing_response.sql",
        ),
    )


def expenditure(name, code="46130", gov="여수시"):
    digest = hashlib.sha256(f"{name}|{code}".encode()).hexdigest()
    return {
        "expenditure_id": "sha256:" + digest,
        "fiscal_year": 2024,
        "region": "전남" if code == "46130" else "광주",
        "government": gov,
        "place_code_raw": code,
        "account": "일반회계",
        "project_name": name,
        "budget_total": 1000,
        "budget_national": 0,
        "budget_province": 0,
        "budget_local": 1000,
        "budget_other": 0,
        "expenditure": 900,
        "balance": 100,
        "field": "환경",
        "sector": "대기",
        "file_name": "2024_세부사업별세출현황.xlsx",
        "license_type": "공공데이터-이용허락범위제한없음",
        "storage_scope": "full",
        "collected_at": "2026-10-29T00:00:00Z",
        "collector": "test",
    }


def load_policies(conn, rows):
    collect(
        PolicyQuery(("12130",)),
        "key",
        PostgresStore(conn),
        fetch=Api({"12130": rows}),
        sleep=lambda _: None,
    )
    refine_raw(conn)


def test_candidates_link_source_versions_and_rerun_adds_nothing(responses_db):
    conn, _ = responses_db
    load_policies(
        conn, [policy("A", sprvsnInstCdNm=YEOSU), policy("B", sprvsnInstCdNm="국토교통부")]
    )
    store_expenditure(
        conn,
        [
            expenditure("청년 월세 지원"),
            expenditure("미세먼지 저감", "29", "본청"),
            expenditure("신재생에너지확대기반조성"),
        ],
    )

    first = extract(conn)
    assert (first["candidates"], first["inserted"], first["changed"]) == (3, 3, 0)
    assert first["current"] == {"A3/lofin": 1, "C1/lofin": 1, "C1/youthcenter": 1}
    rows = conn.execute(
        "SELECT e.card_id, e.origin_ref, e.place_id, e.department,"
        " r.payload->'youthcenter'->>'plcyNo' FROM existing_response e"
        " JOIN raw_record r ON r.content_hash = e.raw_content_hash"
    ).fetchall()
    assert rows == [("C1", "A:12130", "plc_yeosu", YEOSU, "A")]
    # 광주 본청(29)은 6곳에 없는 넓은 단위 → place_id null
    assert conn.execute(
        "SELECT e.place_id, x.project_name FROM existing_response e"
        " JOIN local_expenditure x USING (expenditure_id) WHERE e.card_id = 'A3'"
    ).fetchall() == [(None, "미세먼지 저감")]

    again = extract(conn)
    assert (again["inserted"], again["unchanged"], again["changed"]) == (0, 3, 0)


def test_edited_policy_is_new_version_and_old_one_is_not_current(responses_db):
    conn, _ = responses_db
    load_policies(conn, [policy("A", sprvsnInstCdNm=YEOSU)])
    extract(conn)
    edited = policy("A", sprvsnInstCdNm=YEOSU, bizPrdEndYmd="20261231", lastMdfcnDt="2026-10-30")
    load_policies(conn, [edited])

    result = extract(conn)
    assert (result["inserted"], result["changed"]) == (1, 1)
    rows = conn.execute(
        "SELECT period_end::text, is_current FROM existing_response ORDER BY period_end"
    ).fetchall()
    assert rows == [("2026-01-01", False), ("2027-01-01", True)]


def test_table_requires_exactly_one_source_version(responses_db):
    conn, _ = responses_db
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO existing_response (response_id, card_id, origin, origin_ref,"
            " place_code_raw, name, field_sources, extracted_by, selection_reason, rule_version)"
            " VALUES ('resp:' || repeat('a', 64), 'C1', 'lofin', 'x', '46130', 'x', '{}',"
            " 'rule', 'x', 'existing-0.1')"
        )
