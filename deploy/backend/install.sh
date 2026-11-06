#!/bin/sh
# Install a proxy only; never starts/redeploys Spring or changes DNS.
set -eu
test "$(id -u)" = 0
case "${1:-}" in
    development) host=dev-backend.issue-atlas.kr; port=8080 ;;
    production) host=backend.issue-atlas.kr; port=8081 ;;
    *) echo 'Usage: sudo sh deploy/backend/install.sh development|production' >&2; exit 2 ;;
esac
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cert=backend.issue-atlas.kr
openssl x509 -in "/etc/letsencrypt/live/$cert/fullchain.pem" -noout -checkhost "$host" \
    | grep -q 'does match certificate'
nginx -t
site="/etc/nginx/sites-available/issueatlas-$1-backend.conf"
link="/etc/nginx/sites-enabled/issueatlas-$1-backend.conf"
backup="/var/backups/issueatlas-backend-290-$(date -u +%Y%m%dT%H%M%SZ)-$1"
install -d -m 700 "$backup"
had_site=false
had_link=false
if test -f "$site"; then cp -a "$site" "$backup/nginx.conf"; had_site=true; fi
if test -L "$link"; then had_link=true; fi
rollback() {
    result=$?
    if test "$result" != 0; then
        if "$had_site"; then cp -a "$backup/nginx.conf" "$site"; else rm -f "$site"; fi
        if ! "$had_link"; then rm -f "$link"; fi
        nginx -t && systemctl reload nginx
    fi
    exit "$result"
}
trap rollback EXIT
sed -e "s/BACKEND_HOST/$host/g" -e "s/BACKEND_PORT/$port/g" \
    -e "s/CERT_NAME/$cert/g" "$source_dir/nginx.conf.template" > "$site"
chmod 644 "$site"
ln -sfn "$site" "$link"
nginx -t
systemctl reload nginx
