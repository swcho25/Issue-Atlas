#!/bin/sh
# Manual provisioning only. DNS A grafana.issue-atlas.kr must already point to this EC2.
set -eu
test "$(id -u)" = 0
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
site=/etc/nginx/sites-available/issueatlas-grafana.conf
link=/etc/nginx/sites-enabled/issueatlas-grafana.conf
backup="/var/backups/issueatlas-grafana-$(date -u +%Y%m%dT%H%M%SZ)"
nginx -t
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
install -d -m 755 /var/www/issueatlas-acme
if ! test -s /etc/letsencrypt/live/grafana.issue-atlas.kr/fullchain.pem; then
    cat > "$site" <<'NGINX'
server {
    listen 80;
    server_name grafana.issue-atlas.kr;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/issueatlas-acme;
        try_files $uri =404;
    }
    location / { return 404; }
}
NGINX
    ln -sfn "$site" "$link"
    nginx -t
    systemctl reload nginx
    # Reuses the existing Certbot account. Never reads certificate private keys.
    certbot certonly --webroot -w /var/www/issueatlas-acme \
        -d grafana.issue-atlas.kr --cert-name grafana.issue-atlas.kr \
        --non-interactive --deploy-hook 'systemctl reload nginx'
fi
install -m 644 "$source_dir/nginx.conf" "$site"
ln -sfn "$site" "$link"
nginx -t
systemctl reload nginx
systemctl is-enabled certbot.timer
