"""V0002 계약만 사용한다. 수집 배치는 원자적으로 저장하고 실행 이력은 따로 커밋한다."""

from datetime import UTC, datetime

from psycopg.types.json import Jsonb

from .kosis import LICENSE, VERSION, CollectionError, Query


class PostgresStore:
    def __init__(self, connection):
        if not connection.autocommit:
            raise CollectionError("STORE_REQUIRES_AUTOCOMMIT")
        self.conn = connection

    def start(self, query: Query, run_id: str, started_at: str):
        with self.conn.transaction():
            self.conn.execute(
                "INSERT INTO source (source_id, name, org, license_type, storage_scope) "
                "VALUES (%s, %s, %s, %s, 'full') ON CONFLICT DO NOTHING",
                (query.source_id, "KOSIS 인구이동", "KOSIS", LICENSE),
            )
            source = self.conn.execute(
                "SELECT license_type, storage_scope FROM source WHERE source_id=%s FOR SHARE",
                (query.source_id,),
            ).fetchone()
            if source != (LICENSE, "full"):
                raise CollectionError("SOURCE_CONTRACT_MISMATCH")
            self.conn.execute(
                "INSERT INTO source_spec (spec_id, source_id, method, evidence_class, params) "
                "VALUES (%s, %s, 'api', 'statistics', %s) ON CONFLICT DO NOTHING",
                (query.spec_id, query.source_id, Jsonb(query.identity())),
            )
            spec = self.conn.execute(
                "SELECT source_id, method, evidence_class, params FROM source_spec "
                "WHERE spec_id=%s FOR SHARE",
                (query.spec_id,),
            ).fetchone()
            if spec != (query.source_id, "api", "statistics", query.identity()):
                raise CollectionError("SPEC_CONTRACT_MISMATCH")
            self.conn.execute(
                "INSERT INTO job_run (job_run_id, spec_id, collector_version, started_at) "
                "VALUES (%s, %s, %s, %s)",
                (run_id, query.spec_id, VERSION, started_at),
            )

    def save(self, rows, records):
        inserted = 0
        with self.conn.transaction():
            for row, record in zip(rows, records, strict=True):
                result = self.conn.execute(
                    "INSERT INTO raw_record "
                    "(job_run_id, spec_id, raw_url, content_hash, payload, collected_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s) "
                    "ON CONFLICT (content_hash) DO NOTHING RETURNING id",
                    (
                        record["run_id"],
                        record["spec_id"],
                        record["raw_url"],
                        record["content_hash"],
                        Jsonb(row),
                        record["collected_at"],
                    ),
                )
                inserted += result.fetchone() is not None
        return inserted

    def finish(self, run_id, status, stats):
        with self.conn.transaction():
            self.conn.execute(
                "UPDATE job_run SET status=%s, finished_at=%s, stats=%s WHERE job_run_id=%s",
                (status, datetime.now(UTC), Jsonb(stats), run_id),
            )
