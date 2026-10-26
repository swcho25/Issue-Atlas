"""V0002 계약만 사용한다. 수집 배치는 원자적으로 저장하고 실행 이력은 따로 커밋한다."""

from datetime import UTC, datetime

from psycopg.types.json import Jsonb

from .kosis import CollectionError


class PostgresStore:
    def __init__(self, connection):
        if not connection.autocommit:
            raise CollectionError("STORE_REQUIRES_AUTOCOMMIT")
        self.conn = connection

    def start(self, query, run_id: str, started_at: str):
        with self.conn.transaction():
            self.conn.execute(
                "INSERT INTO source (source_id, name, org, license_type, storage_scope) "
                "VALUES (%s, %s, %s, %s, 'full') ON CONFLICT DO NOTHING",
                (query.source_id, query.source_name, query.source_org, query.license_type),
            )
            source = self.conn.execute(
                "SELECT license_type, storage_scope FROM source WHERE source_id=%s FOR SHARE",
                (query.source_id,),
            ).fetchone()
            if source != (query.license_type, "full"):
                raise CollectionError("SOURCE_CONTRACT_MISMATCH")
            self.conn.execute(
                "INSERT INTO source_spec (spec_id, source_id, method, evidence_class, params) "
                "VALUES (%s, %s, %s, 'statistics', %s) ON CONFLICT DO NOTHING",
                (query.spec_id, query.source_id, query.method, Jsonb(query.identity())),
            )
            spec = self.conn.execute(
                "SELECT source_id, method, evidence_class, params FROM source_spec "
                "WHERE spec_id=%s FOR SHARE",
                (query.spec_id,),
            ).fetchone()
            if spec != (query.source_id, query.method, "statistics", query.identity()):
                raise CollectionError("SPEC_CONTRACT_MISMATCH")
            self.conn.execute(
                "INSERT INTO job_run (job_run_id, spec_id, collector_version, started_at, stats) "
                "VALUES (%s, %s, %s, %s, %s)",
                (
                    run_id,
                    query.spec_id,
                    query.collector_version,
                    started_at,
                    Jsonb(query.run_params() if hasattr(query, "run_params") else {}),
                ),
            )

    def save(self, rows, records):
        # 장부(c1_record, V0005)는 원본과 같은 행에 둔다. P2 는 이 칸만 읽는다.
        # 같은 원본을 다시 받으면 처음 장부를 그대로 두고, 장부가 비어 있던 옛 행만 채운다.
        inserted = 0
        with self.conn.transaction():
            for row, record in zip(rows, records, strict=True):
                result = self.conn.execute(
                    "INSERT INTO raw_record "
                    "(job_run_id, spec_id, raw_url, file_name, "
                    "content_hash, payload, collected_at, c1_record) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                    "ON CONFLICT (content_hash) DO UPDATE SET c1_record = EXCLUDED.c1_record "
                    "WHERE raw_record.c1_record IS NULL "
                    "RETURNING (xmax = 0)",
                    (
                        record["run_id"],
                        record["spec_id"],
                        record["raw_url"],
                        record.get("file_name"),
                        record["content_hash"],
                        Jsonb(row),
                        record["collected_at"],
                        Jsonb(record),
                    ),
                )
                saved = result.fetchone()
                inserted += saved is not None and saved[0]
        return inserted

    def finish(self, run_id, status, stats):
        with self.conn.transaction():
            self.conn.execute(
                "UPDATE job_run SET status=%s, finished_at=%s, stats=%s WHERE job_run_id=%s",
                (status, datetime.now(UTC), Jsonb(stats), run_id),
            )
