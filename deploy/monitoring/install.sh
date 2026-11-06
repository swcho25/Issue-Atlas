#!/bin/sh
# Run as root from a trusted checkout. Does not restart application containers.
set -eu
test "$(id -u)" = 0
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
destination=/opt/issueatlas-monitoring
install -d -m 755 "$destination"
if test -f "$destination/compose.yaml"; then
    backup="/var/backups/issueatlas-monitoring-$(date -u +%Y%m%dT%H%M%SZ)"
    install -d -m 700 "$backup"
    cp -a "$destination/." "$backup/"
fi
install -d -m 700 /etc/issueatlas/monitoring
password=/etc/issueatlas/monitoring/grafana-admin-password
if ! test -f "$password"; then
    (umask 077; openssl rand -base64 36 > "$password")
    chown 472:472 "$password"
    chmod 400 "$password"
fi
cp -a "$source_dir/." "$destination/"
cd "$destination"
docker compose config --quiet
docker compose pull
docker compose run --rm --no-deps --entrypoint /bin/promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose up -d
docker compose ps
