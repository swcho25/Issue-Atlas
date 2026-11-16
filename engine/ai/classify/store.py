"""기사·승인 카드 읽기와 분류 결과 저장."""

import json
import os
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .model import (
    INPUT_VERSION,
    MODEL,
    PROFILE_VERSION,
    REBUTTAL_QUERY_VERSION,
    CardRule,
    card_profile,
    decide,
    digest,
    document_input,
    rebuttal_queries,
)

ROOT = Path(__file__).resolve().parents[3]

DOCUMENTS = """
SELECT DISTINCT ON (e.news_id)
    e.news_id, n.record->'document'->>'title' AS title, e.summary, n.content_hash
FROM news_event e
JOIN normalized_ready n ON n.record->'locator'->>'news_id' = e.news_id
JOIN raw_record r ON r.content_hash = n.content_hash
WHERE n.record->'document'->>'kind' = 'news'
  AND nullif(btrim(e.summary), '') IS NOT NULL
  AND nullif(btrim(n.record->'document'->>'title'), '') IS NOT NULL
ORDER BY e.news_id, n.refined_at DESC, n.id DESC
"""
CARDS = """
SELECT c.card_id, v.version, v.spec
FROM card c JOIN card_version v
  ON v.card_id = c.card_id AND v.version = c.current_version
WHERE c.card_id IN ('C1', 'A3') AND c.status = 'card'
ORDER BY c.card_id
"""
SCORES = """
SELECT d.doc_id, c.card_id, d.input_id, c.card_version, c.profile_version,
       1 - (d.embedding <=> c.embedding) AS similarity
FROM document_embedding_v1 d CROSS JOIN card_search_profile c
JOIN card approved ON approved.card_id = c.card_id
WHERE d.is_active AND c.is_active AND d.model = c.model
  AND approved.status = 'card' AND approved.current_version = c.card_version
ORDER BY c.card_id, similarity DESC, d.doc_id
"""
# f4 확률 입력: 활성 기사 벡터의 입력 문장 · 입력 판 · 벡터(pgvector 문자열 '[…]')
SCORE_INPUTS = """
SELECT d.input_id, i.input_text, i.input_version, d.embedding::text
FROM document_embedding_v1 d JOIN document_search_input i ON i.input_id = d.input_id
WHERE d.is_active AND d.model = %s
ORDER BY d.input_id
"""


def connect(database: str | None = None):
    """다른 수집기와 같은 루트 .env를 런타임에 사용한다. 값은 출력하지 않는다."""
    config = dotenv_values(ROOT / ".env", interpolate=False)
    password = os.environ.get("DB_PASSWORD") or config.get("DB_PASSWORD")
    if not password:
        raise RuntimeError("DB_PASSWORD가 설정되지 않았습니다")
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST") or config.get("POSTGRES_HOST") or "localhost",
        port=os.environ.get("POSTGRES_PORT") or config.get("POSTGRES_PORT") or "5432",
        dbname=database or os.environ.get("DB_NAME") or config.get("DB_NAME") or "issue_atlas",
        user=os.environ.get("DB_USERNAME") or config.get("DB_USERNAME") or "postgres",
        password=password,
        connect_timeout=5,
        autocommit=True,
    )


def documents(conn):
    with conn.cursor() as cur:
        cur.execute(DOCUMENTS)
        return [document_input(*row) for row in cur.fetchall()]


def existing_document_inputs(conn, input_ids: list[str]) -> set[str]:
    """이미 저장된 벡터의 입력 ID. 비활성 벡터도 재사용 대상이다."""
    if not input_ids:
        return set()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT input_id FROM document_embedding_v1 WHERE input_id = ANY(%s)",
            (input_ids,),
        )
        return {row[0] for row in cur.fetchall()}


def cards(conn):
    with conn.cursor() as cur:
        cur.execute(CARDS)
        rows = cur.fetchall()
    if {row[0] for row in rows} != {"C1", "A3"}:
        raise RuntimeError("C1·A3 승인본이 없습니다. 카드 seed와 승인을 확인하세요")
    return [(card_id, version, card_profile(spec)) for card_id, version, spec in rows]


def current_document(conn, input_id: str):
    with conn.cursor() as cur:
        cur.execute("SELECT is_active FROM document_embedding_v1 WHERE input_id = %s", (input_id,))
        row = cur.fetchone()
    return None if row is None else row[0]


def save_document(conn, item, vector: list[float] | None):
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (item.doc_id,))
        cur.execute(
            """INSERT INTO document_search_input
               (input_id, doc_id, news_id, raw_content_hash, input_version, input_text, input_hash)
               VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
            (
                item.input_id,
                item.doc_id,
                item.news_id,
                item.raw_content_hash,
                INPUT_VERSION,
                item.input_text,
                item.input_hash,
            ),
        )
        cur.execute(
            "UPDATE document_embedding_v1 SET is_active = false "
            "WHERE doc_id = %s AND is_active AND input_id <> %s",
            (item.doc_id, item.input_id),
        )
        if vector is not None:
            cur.execute(
                """INSERT INTO document_embedding_v1
                   (input_id, doc_id, model, embedding, is_active)
                   VALUES (%s, %s, %s, %s::vector, true)
                   ON CONFLICT (input_id) DO UPDATE SET is_active = true""",
                (item.input_id, item.doc_id, MODEL, str(vector)),
            )
        else:
            cur.execute(
                "UPDATE document_embedding_v1 SET is_active = true WHERE input_id = %s",
                (item.input_id,),
            )


def deactivate_missing_documents(conn, active_doc_ids: list[str]) -> int:
    """더는 제목·요약 입력이 없는 문서의 활성 벡터를 끈다."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT doc_id FROM document_embedding_v1 WHERE is_active AND NOT (doc_id = ANY(%s))",
            (active_doc_ids,),
        )
        stale = [row[0] for row in cur.fetchall()]
    for doc_id in stale:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (doc_id,))
            cur.execute(
                "UPDATE document_embedding_v1 SET is_active = false "
                "WHERE doc_id = %s AND is_active",
                (doc_id,),
            )
    return len(stale)


def current_card(conn, card_id: str, version: int, profile_hash: str):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT is_active FROM card_search_profile
               WHERE card_id = %s AND card_version = %s AND profile_version = %s
                 AND profile_hash = %s AND model = %s""",
            (card_id, version, PROFILE_VERSION, profile_hash, MODEL),
        )
        row = cur.fetchone()
    return None if row is None else row[0]


def save_card(conn, card_id: str, version: int, text: str, vector: list[float] | None):
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 1))", (card_id,))
        cur.execute(
            "UPDATE card_search_profile SET is_active = false WHERE card_id = %s AND is_active",
            (card_id,),
        )
        if vector is not None:
            cur.execute(
                """INSERT INTO card_search_profile
                   (card_id, card_version, profile_version, profile_text, profile_hash,
                    model, embedding, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector, true)
                   ON CONFLICT (card_id, card_version, profile_version)
                   DO UPDATE SET profile_text = EXCLUDED.profile_text,
                     profile_hash = EXCLUDED.profile_hash, model = EXCLUDED.model,
                     embedding = EXCLUDED.embedding, is_active = true,
                     embedded_at = now()""",
                (card_id, version, PROFILE_VERSION, text, digest(text), MODEL, str(vector)),
            )
        else:
            cur.execute(
                """UPDATE card_search_profile SET is_active = true
                   WHERE card_id = %s AND card_version = %s AND profile_version = %s""",
                (card_id, version, PROFILE_VERSION),
            )


def card_rebuttals(conn) -> list[tuple[str, int, str, str]]:
    """승인 카드 판의 반박 검색 질의: (card_id, card_version, rebuttal_id, 질의 문장)"""
    with conn.cursor() as cur:
        cur.execute(CARDS)
        rows = cur.fetchall()
    return [
        (card_id, version, rebuttal_id, text)
        for card_id, version, spec in rows
        for rebuttal_id, text in rebuttal_queries(spec)
    ]


def current_rebuttal(conn, card_id: str, version: int, rebuttal_id: str, query_hash: str):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT is_active FROM card_rebuttal_profile
               WHERE card_id = %s AND card_version = %s AND rebuttal_id = %s
                 AND query_version = %s AND query_hash = %s AND model = %s""",
            (card_id, version, rebuttal_id, REBUTTAL_QUERY_VERSION, query_hash, MODEL),
        )
        row = cur.fetchone()
    return None if row is None else row[0]


def save_rebuttal(
    conn, card_id: str, version: int, rebuttal_id: str, text: str, vector: list[float] | None
):
    """(카드, 반박)마다 활성 하나. 같은 판 · 질의 판이 이미 있으면 vector=None 으로 다시 켠다."""
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 2))", (f"{card_id}|{rebuttal_id}",)
        )
        cur.execute(
            "UPDATE card_rebuttal_profile SET is_active = false "
            "WHERE card_id = %s AND rebuttal_id = %s AND is_active",
            (card_id, rebuttal_id),
        )
        if vector is not None:
            cur.execute(
                """INSERT INTO card_rebuttal_profile
                   (card_id, card_version, rebuttal_id, query_version, query_text, query_hash,
                    model, embedding, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector, true)
                   ON CONFLICT (card_id, card_version, rebuttal_id, query_version)
                   DO UPDATE SET query_text = EXCLUDED.query_text,
                     query_hash = EXCLUDED.query_hash, model = EXCLUDED.model,
                     embedding = EXCLUDED.embedding, is_active = true, embedded_at = now()""",
                (
                    card_id,
                    version,
                    rebuttal_id,
                    REBUTTAL_QUERY_VERSION,
                    text,
                    digest(text),
                    MODEL,
                    str(vector),
                ),
            )
        else:
            cur.execute(
                """UPDATE card_rebuttal_profile SET is_active = true
                   WHERE card_id = %s AND card_version = %s AND rebuttal_id = %s
                     AND query_version = %s""",
                (card_id, version, rebuttal_id, REBUTTAL_QUERY_VERSION),
            )


def deactivate_missing_rebuttals(conn, keep: set[tuple[str, int, str]]) -> int:
    """승인본에서 빠진 반박 · 옛 판 · 옛 질의 판의 활성 질의를 끈다."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT card_id, card_version, rebuttal_id, query_version "
            "FROM card_rebuttal_profile WHERE is_active"
        )
        stale = [
            row for row in cur.fetchall() if row[:3] not in keep or row[3] != REBUTTAL_QUERY_VERSION
        ]
    with conn.transaction(), conn.cursor() as cur:
        for row in stale:
            cur.execute(
                "UPDATE card_rebuttal_profile SET is_active = false "
                "WHERE card_id = %s AND card_version = %s AND rebuttal_id = %s "
                "AND query_version = %s AND is_active",
                row,
            )
    return len(stale)


def scores(conn):
    with conn.cursor() as cur:
        cur.execute(SCORES)
        return cur.fetchall()


def score_inputs(conn):
    """활성 기사 입력을 (input_id, 입력 문장, 입력 판, 벡터) 로 하나씩 돌려준다.

    서버 커서로 200건씩 읽어 기사 벡터를 한꺼번에 메모리에 올리지 않는다.
    """
    with conn.transaction(), conn.cursor(name="classify_score_inputs") as cur:
        cur.itersize = 200
        cur.execute(SCORE_INPUTS, (MODEL,))
        for input_id, text, input_version, embedding in cur:
            yield input_id, text, input_version, json.loads(embedding)


def save_scores(
    conn,
    rows,
    rules: dict[str, CardRule],
    threshold_version: str,
    probabilities: dict[tuple[str, str], float] | None = None,
):
    """방식(V0052 method)과 함께 저장한다.

    f4 카드는 (doc_id, card_id) 확률을, cosine 카드는 빈 확률을 쓴다.
    """
    probabilities = probabilities or {}
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            """DELETE FROM document_card_score s
               WHERE NOT EXISTS (
                 SELECT 1 FROM document_embedding_v1 d
                 JOIN document_search_input i ON i.input_id = d.input_id
                 CROSS JOIN card_search_profile c
                 JOIN card approved ON approved.card_id = c.card_id
                 WHERE d.doc_id = s.doc_id AND c.card_id = s.card_id
                   AND d.is_active AND c.is_active AND d.model = c.model
                   AND approved.status = 'card' AND approved.current_version = c.card_version
               )"""
        )
        for doc_id, card_id, input_id, card_version, profile_version, similarity in rows:
            rule = rules[card_id]
            probability = probabilities.get((doc_id, card_id)) if rule.method == "f4" else None
            cur.execute(
                """INSERT INTO document_card_score
                   (doc_id, card_id, input_id, card_version, profile_version, model,
                    cosine_similarity, threshold_version, threshold, selected,
                    method, probability)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (doc_id, card_id) DO UPDATE SET
                     input_id = EXCLUDED.input_id, card_version = EXCLUDED.card_version,
                     profile_version = EXCLUDED.profile_version, model = EXCLUDED.model,
                     cosine_similarity = EXCLUDED.cosine_similarity,
                     threshold_version = EXCLUDED.threshold_version,
                     threshold = EXCLUDED.threshold, selected = EXCLUDED.selected,
                     method = EXCLUDED.method, probability = EXCLUDED.probability,
                     scored_at = now()""",
                (
                    doc_id,
                    card_id,
                    input_id,
                    card_version,
                    profile_version,
                    MODEL,
                    similarity,
                    threshold_version,
                    rule.threshold,
                    decide(rule, similarity, probability),
                    rule.method,
                    probability,
                ),
            )


def sample_rows(conn):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT s.card_id, s.doc_id, s.cosine_similarity, s.threshold,
                      s.selected, e.news_id, e.summary, i.input_text
               FROM document_card_score s
               JOIN document_search_input i ON i.input_id = s.input_id
               JOIN news_event e ON e.news_id = i.news_id
               ORDER BY s.card_id, s.cosine_similarity DESC, s.doc_id"""
        )
        return cur.fetchall()
