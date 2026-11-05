#!/usr/bin/env bash
# 질문 부하 시험 한 번(S15P31C108-260). 빈 PostGIS · 가짜 engine · backend jar 를 띄우고 k6 를 돌린 뒤 모두 내린다.
#   bash backend/loadtest/run.sh <backend jar> <결과 폴더>
# 환경 변수: DELAY_SECONDS(가짜 engine 지연, 13) · QUESTION_VUS(30) · PROBE_RPS(5) · DURATION(120s)
# 결과 폴더: summary.json(k6 요약) · k6.csv(요청별) · pool.log(Hikari 1초 통계) · pg.csv(DB 연결 상태 1초) · engine.json · backend.log
set -euo pipefail

JAR=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
OUT=$2
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
PG=atlas-loadtest-pg
PG_PORT=55432
APP_PORT=18080
ENGINE_PORT=18000
# 2026-11-05 확인한 grafana/k6:1.3.0
K6_IMAGE=grafana/k6:1.3.0@sha256:3ddc8b1a33a2c3d8edc6e99b6a762ae36cba08788463458f5e6a7703e14eb77d
DB_IMAGE=issueatlas-postgres:17-3.5-pgvector-0.8.7

mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
pids=()
cleanup() {
    for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
    docker rm -f "$PG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== DB ($DB_IMAGE, :$PG_PORT)"
docker image inspect "$DB_IMAGE" >/dev/null 2>&1 || docker compose -f "$ROOT/docker-compose.yml" build postgres
docker rm -f "$PG" >/dev/null 2>&1 || true
docker run -d --name "$PG" -p "$PG_PORT:5432" -e POSTGRES_DB=issue_atlas -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=loadtest -e TZ=UTC "$DB_IMAGE" >/dev/null
until docker exec "$PG" pg_isready -U postgres -d issue_atlas -q 2>/dev/null; do sleep 1; done
sleep 2

echo "== 가짜 engine (:$ENGINE_PORT, ${DELAY_SECONDS:-13}s)"
PORT=$ENGINE_PORT DELAY_SECONDS=${DELAY_SECONDS:-13} python "$HERE/fake_engine.py" &
pids+=($!)

echo "== backend ($JAR)"
# Hikari 통계 로그를 1초마다(기본 30초). 질문 한도는 시험에서 끈다
DB_URL=jdbc:postgresql://localhost:$PG_PORT/issue_atlas DB_USERNAME=postgres DB_PASSWORD=loadtest \
    ENGINE_URL=http://127.0.0.1:$ENGINE_PORT SERVER_PORT=$APP_PORT QUESTIONS_PER_MINUTE=1000000 \
    java -Dcom.zaxxer.hikari.housekeeping.periodMs=1000 -jar "$JAR" \
    --logging.level.com.zaxxer.hikari.pool.HikariPool=DEBUG >"$OUT/backend.log" 2>&1 &
pids+=($!)
for _ in $(seq 1 120); do
    curl -sf "http://127.0.0.1:$APP_PORT/actuator/health" >/dev/null && break
    sleep 1
done
curl -sf "http://127.0.0.1:$APP_PORT/actuator/health" >/dev/null || { tail -40 "$OUT/backend.log"; exit 1; }

echo "== 카드 시드"
docker exec -i "$PG" psql -q -U postgres -d issue_atlas -v ON_ERROR_STOP=1 \
    -c "SET issue_atlas.approver = 'loadtest@seed.test'" -f - <"$ROOT/backend/db/seed/cards-c1-a3.sql"

echo "== 연결 상태 기록 시작"
(
    echo "ts,active,idle_in_tx,idle,total"
    while true; do
        docker exec "$PG" psql -U postgres -d issue_atlas -AtF, -c \
            "SELECT extract(epoch FROM now())::bigint, count(*) FILTER (WHERE state = 'active'),
                    count(*) FILTER (WHERE state = 'idle in transaction'), count(*) FILTER (WHERE state = 'idle'),
                    count(*)
             FROM pg_stat_activity WHERE datname = 'issue_atlas' AND pid <> pg_backend_pid()
               AND application_name LIKE 'PostgreSQL JDBC%'" 2>/dev/null | grep -E '^[0-9]' || true
        sleep 1
    done
) >"$OUT/pg.csv" &
pids+=($!)

echo "== k6"
MSYS_NO_PATHCONV=1 docker run --rm -i -v "$(cygpath -w "$OUT" 2>/dev/null || echo "$OUT"):/out" \
    -e BASE_URL=http://host.docker.internal:$APP_PORT -e QUESTION_VUS="${QUESTION_VUS:-30}" \
    -e PROBE_RPS="${PROBE_RPS:-5}" -e DURATION="${DURATION:-120s}" \
    "$K6_IMAGE" run --quiet --summary-export /out/summary.json --out csv=/out/k6.csv - <"$HERE/question.js" \
    | tee "$OUT/k6.txt" || true

curl -sf "http://127.0.0.1:$ENGINE_PORT/stats" >"$OUT/engine.json" || true
grep "Pool stats" "$OUT/backend.log" >"$OUT/pool.log" || true
echo "== 끝: $OUT"
