#!/usr/bin/env bash
# 사용자 여정 부하 시험 한 번(S15P31C108-340). dev-data.sh restore 로 만든 issue_atlas_seed 를 복사해 새 issue_atlas 를 만들고,
# 가짜 engine · backend(컨테이너, CPU 제한) · k6(journey.js)를 돌린 뒤 backend · engine 을 내린다. DB 컨테이너는 남긴다.
#   bash backend/loadtest/journey.sh <backend jar> <결과 폴더>
# 환경 변수: MODE(journey | read) · DELAY_SECONDS(가짜 engine 지연, 5) · PEAK_VUS(100) · THINK_SECONDS(1) · EVIDENCE_PER_VISIT(3) · STAGES(k6 단계 JSON)
#           APP_CPUS(2) · DB_CPUS(2) · HIKARI_MAX(기본 10) · ENGINE_CACHE_SIZE(backend 기본 500)
# 결과 폴더: summary.json · k6.csv · k6.txt · pool.log(Hikari 1초) · pg.csv(DB 연결 1초) · stats.csv(docker stats 2초)
#           statements.csv(pg_stat_statements 상위) · runs.csv(실행별 서버 시간) · engine.json · backend.log
set -euo pipefail

JAR=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
OUT=$2
HERE=$(cd "$(dirname "$0")" && pwd)
PG=atlas-journey-pg
APP=atlas-journey-app
NET=atlas-journey
PG_PORT=${PG_PORT:-55433}
APP_PORT=18081
ENGINE_PORT=18001
DB_IMAGE=issueatlas-postgres:17-3.5-pgvector-0.8.7
# 2026-11-05 확인한 grafana/k6:1.3.0 · eclipse-temurin:21-jre(로컬에 있던 것, digest 는 docker images --digests 로 확인)
K6_IMAGE=grafana/k6:1.3.0@sha256:3ddc8b1a33a2c3d8edc6e99b6a762ae36cba08788463458f5e6a7703e14eb77d
JRE_IMAGE=${JRE_IMAGE:-eclipse-temurin:21-jre}
PYTHON=${PYTHON:-python}
winpath() { cygpath -w "$1" 2>/dev/null || echo "$1"; }

mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
pids=()
cleanup() {
    for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
    docker logs "$APP" >"$OUT/backend.log" 2>&1 || true
    docker rm -f "$APP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
echo "== DB ($PG, CPU ${DB_CPUS:-2}, pg_stat_statements)"
docker volume inspect atlas-journey-pgdata >/dev/null 2>&1 || { echo "먼저 dev-data.sh restore"; exit 1; }
docker rm -f "$PG" >/dev/null 2>&1 || true
docker run -d --name "$PG" --network "$NET" -p "$PG_PORT:5432" --cpus "${DB_CPUS:-2}" --memory 4g --shm-size 512m \
    -v atlas-journey-pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=loadtest -e TZ=UTC "$DB_IMAGE" \
    -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all -c track_io_timing=on >/dev/null
until docker exec "$PG" pg_isready -U postgres -q 2>/dev/null; do sleep 1; done
sleep 2
docker exec "$PG" dropdb -U postgres --if-exists issue_atlas
docker exec "$PG" createdb -U postgres -T issue_atlas_seed issue_atlas
docker exec "$PG" psql -q -U postgres -d issue_atlas -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" \
    -c "SELECT pg_stat_statements_reset()" >/dev/null

echo "== 가짜 engine (:$ENGINE_PORT, ${DELAY_SECONDS:-5}s)"
PORT=$ENGINE_PORT HOST=0.0.0.0 DELAY_SECONDS=${DELAY_SECONDS:-5} $PYTHON "$HERE/fake_engine.py" &
pids+=($!)

echo "== backend ($JAR, CPU ${APP_CPUS:-2})"
docker rm -f "$APP" >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name "$APP" --network "$NET" -p "$APP_PORT:8080" --cpus "${APP_CPUS:-2}" --memory 2g \
    -v "$(winpath "$JAR"):/app.jar:ro" \
    -e DB_URL=jdbc:postgresql://$PG:5432/issue_atlas -e DB_USERNAME=postgres -e DB_PASSWORD=loadtest \
    -e ENGINE_URL=http://host.docker.internal:$ENGINE_PORT -e SERVER_PORT=8080 -e QUESTIONS_PER_MINUTE=1000000 \
    ${ENGINE_CACHE_SIZE:+-e ENGINE_CACHE_SIZE=$ENGINE_CACHE_SIZE} \
    ${HIKARI_MAX:+-e SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=$HIKARI_MAX} \
    "$JRE_IMAGE" java -Dcom.zaxxer.hikari.housekeeping.periodMs=1000 -jar /app.jar \
    --logging.level.com.zaxxer.hikari.pool.HikariPool=DEBUG >/dev/null
for _ in $(seq 1 180); do
    curl -sf "http://127.0.0.1:$APP_PORT/actuator/health" >/dev/null && break
    sleep 1
done
curl -sf "http://127.0.0.1:$APP_PORT/actuator/health" >/dev/null || { docker logs --tail 60 "$APP"; exit 1; }
docker exec "$PG" psql -q -U postgres -d issue_atlas -c "SELECT pg_stat_statements_reset()" >/dev/null
START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "== 기록 시작 (연결 상태 1초 · 컨테이너 CPU 2초)"
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
(
    echo "ts,name,cpu,mem"
    while true; do
        docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" "$PG" "$APP" 2>/dev/null \
            | sed "s/^/$(date +%s),/" || true
        sleep 2
    done
) >"$OUT/stats.csv" &
pids+=($!)

echo "== k6 (최대 ${PEAK_VUS:-100}명)"
MSYS_NO_PATHCONV=1 docker run --rm -i --network "$NET" -v "$(winpath "$OUT"):/out" \
    -e BASE_URL=http://$APP:8080 -e PEAK_VUS="${PEAK_VUS:-100}" -e THINK_SECONDS="${THINK_SECONDS:-1}" \
    -e EVIDENCE_PER_VISIT="${EVIDENCE_PER_VISIT:-3}" -e STAGES="${STAGES:-}" -e MODE="${MODE:-journey}" \
    "$K6_IMAGE" run --quiet --summary-export /out/summary.json --out csv=/out/k6.csv - <"$HERE/journey.js" \
    | tee "$OUT/k6.txt" || true

curl -sf "http://127.0.0.1:$ENGINE_PORT/stats" >"$OUT/engine.json" || true
echo "== DB 쿼리 상위(총 시간) · 실행별 서버 시간"
docker exec "$PG" psql -U postgres -d issue_atlas --csv -c \
    "SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms,
            round(max_exec_time::numeric, 1) AS max_ms, rows, shared_blks_hit, shared_blks_read,
            regexp_replace(left(query, 300), '\s+', ' ', 'g') AS query
     FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'issue_atlas')
     ORDER BY total_exec_time DESC LIMIT 40" >"$OUT/statements.csv" || true
docker exec "$PG" psql -U postgres -d issue_atlas --csv -c \
    "SELECT r.run_id, q.card_id, q.place_id, q.period_start, q.period_end, r.run_status, r.duration_ms,
            p.status AS phrasing_status, p.duration_ms AS phrasing_ms,
            (SELECT count(*) FROM argument_run_source s WHERE s.run_id = r.run_id) AS sources
     FROM argument_run r JOIN question q USING (question_id) LEFT JOIN argument_phrasing p USING (run_id)
     WHERE r.created_at >= '$START_TS'" >"$OUT/runs.csv" || true
docker logs "$APP" 2>&1 | grep "Pool stats" >"$OUT/pool.log" || true
echo "== 끝: $OUT"
