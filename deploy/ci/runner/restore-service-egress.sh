#!/bin/sh
# Two Docker daemons share iptables chains. Keep the service bridge's outbound path.
set -eu
external=$(ip -4 -o route show default | awk 'NR == 1 {print $5}')
test -n "$external"
ensure_rule() {
    iptables --wait -C DOCKER-USER "$@" 2>/dev/null ||
        iptables --wait -I DOCKER-USER 1 "$@"
}
# engine: argument phrasing API network (GMS calls only; S15P31C108-243)
for network in issueatlas-dev_default issueatlas-prod_default issueatlas-dev_engine issueatlas-prod_engine; do
    docker network inspect "$network" >/dev/null 2>&1 || continue
    id=$(docker network inspect --format '{{.Id}}' "$network")
    subnet=$(docker network inspect --format '{{(index .IPAM.Config 0).Subnet}}' "$network")
    bridge="br-$(printf '%s' "$id" | cut -c1-12)"
    ip link show "$bridge" >/dev/null
    ensure_rule -i "$bridge" -s "$subnet" -o "$external" -j ACCEPT
    ensure_rule -i "$external" -o "$bridge" -d "$subnet" \
        -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
done
