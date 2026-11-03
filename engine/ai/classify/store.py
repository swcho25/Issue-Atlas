"""기사·승인 카드 읽기와 분류 결과 저장."""

import os
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from .model import INPUT_VERSION, MODEL, PROFILE_VERSION, card_profile, digest, document_input

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


def scores(conn):
    with conn.cursor() as cur:
        cur.execute(SCORES)
        return cur.fetchall()


def save_scores(conn, rows, thresholds: dict[str, float], threshold_version: str):
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
            threshold = thresholds[card_id]
            cur.execute(
                """INSERT INTO document_card_score
                   (doc_id, card_id, input_id, card_version, profile_version, model,
                    cosine_similarity, threshold_version, threshold, selected)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (doc_id, card_id) DO UPDATE SET
                     input_id = EXCLUDED.input_id, card_version = EXCLUDED.card_version,
                     profile_version = EXCLUDED.profile_version, model = EXCLUDED.model,
                     cosine_similarity = EXCLUDED.cosine_similarity,
                     threshold_version = EXCLUDED.threshold_version,
                     threshold = EXCLUDED.threshold, selected = EXCLUDED.selected,
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
                    threshold,
                    similarity >= threshold,
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
