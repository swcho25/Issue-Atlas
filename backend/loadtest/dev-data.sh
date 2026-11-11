#!/usr/bin/env bash
# 여정 부하 시험용 DB(S15P31C108-340). dev DB 를 읽기 전용으로 덤프해 로컬 PostGIS(:55433)의 issue_atlas_seed 에 올린다.
#   bash backend/loadtest/dev-data.sh dump <폴더>      dev 에서 덤프 3개를 받는다(SSH 필요, dev DB 에 쓰지 않는다)
#   bash backend/loadtest/dev-data.sh restore <폴더>   로컬 컨테이너를 만들고 issue_atlas_seed 로 복원한다
# raw_record(7.4 GB, 대부분 대기 시간 자료)는 다른 표가 참조하는 행만 가져오고, app_user 는 이메일 · 비밀번호를 지운다.
# 덤프 폴더는 저장소 밖(또는 git 이 무시하는 backend/loadtest/out/)에 둔다. 개인 정보는 없지만 수집 원문이 들어 있다.
set -euo pipefail

MODE=$1
DIR=$2
PG=atlas-journey-pg
PG_PORT=${PG_PORT:-55433}
DB_IMAGE=issueatlas-postgres:17-3.5-pgvector-0.8.7
SSH_KEY=${SSH_KEY:-$HOME/Downloads/K15C108T.pem}
SSH_HOST=${SSH_HOST:-ubuntu@k15c108.p.ssafy.io}
DEV_PG=issueatlas-dev-postgres-1
mkdir -p "$DIR"

remote() { # dev 컨테이너 안에서 sh -c (POSTGRES_USER · POSTGRES_DB 는 컨테이너 환경 변수)
    ssh -o BatchMode=yes -i "$SSH_KEY" "$SSH_HOST" "sudo docker exec -i $DEV_PG sh -c '$1'"
}
PSQL_DEV='psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-issue_atlas}'
RAW_SUBSET="SELECT * FROM raw_record WHERE content_hash IN (SELECT content_hash FROM normalized_record
  UNION SELECT raw_content_hash FROM existing_response UNION SELECT raw_content_hash FROM document_search_input)"
USERS="SELECT id, 'user' || id || '@loadtest.test', '{noop}disabled', 'user' || id, role, is_active, created_by,
  created_at, updated_at, NULL FROM app_user"

if [ "$MODE" = dump ]; then
    echo "== dev 덤프 (raw_record · app_user 자료 빼고)"
    remote 'pg_dump -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-issue_atlas} -Fc -Z6 --exclude-table-data=raw_record --exclude-table-data=app_user' \
        >"$DIR/dev-noraw.dump"
    echo "== raw_record 중 참조되는 행"
    echo "COPY ($RAW_SUBSET) TO STDOUT" | remote "$PSQL_DEV | gzip -1" >"$DIR/raw_subset.copy.gz"
    echo "== app_user (이메일 · 비밀번호 지움)"
    echo "COPY ($USERS) TO STDOUT" | remote "$PSQL_DEV" >"$DIR/app_user.copy"
    ls -la "$DIR"
    exit 0
fi

[ "$MODE" = restore ] || { echo "dump | restore"; exit 2; }
echo "== 로컬 DB ($PG, :$PG_PORT)"
docker image inspect "$DB_IMAGE" >/dev/null 2>&1 || docker compose -f "$(dirname "$0")/../../docker-compose.yml" build postgres
docker rm -f "$PG" >/dev/null 2>&1 || true
docker volume rm atlas-journey-pgdata >/dev/null 2>&1 || true
docker run -d --name "$PG" -p "$PG_PORT:5432" -v atlas-journey-pgdata:/var/lib/postgresql/data \
    -e POSTGRES_DB=postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=loadtest -e TZ=UTC "$DB_IMAGE" >/dev/null
until docker exec "$PG" pg_isready -U postgres -q 2>/dev/null; do sleep 1; done
sleep 2
docker exec "$PG" createdb -U postgres issue_atlas_seed
psql_seed() { docker exec -i "$PG" psql -q -U postgres -d issue_atlas_seed -v ON_ERROR_STOP=1 "$@"; }
restore() { # 소유자 · 권한은 dev 역할이라 버린다. 확장이 이미 있다는 경고는 무시
    MSYS_NO_PATHCONV=1 docker exec -i "$PG" pg_restore -U postgres -d issue_atlas_seed --no-owner --no-acl "$@" \
        <"$DIR/dev-noraw.dump" || true
}
echo "== 스키마"
restore --section=pre-data
echo "== 자료"
restore --section=data
gzip -dc "$DIR/raw_subset.copy.gz" | psql_seed -c "COPY raw_record FROM STDIN"
psql_seed -c "COPY app_user FROM STDIN" <"$DIR/app_user.copy"
echo "== 색인 · 제약"
restore --section=post-data
psql_seed -c "ANALYZE"
psql_seed -At -c "SELECT 'flyway ' || max(version) FROM flyway_schema_history WHERE success" \
    -c "SELECT relname || ' ' || n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 1000 ORDER BY n_live_tup DESC"
echo "== 끝: issue_atlas_seed (:$PG_PORT). journey.sh 가 시험마다 이것을 복사해 issue_atlas 를 만든다"
