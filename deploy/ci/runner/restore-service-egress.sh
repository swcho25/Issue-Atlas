#!/bin/sh
# Two Docker daemons share iptables chains. Keep the service bridge's outbound path.
set -eu
network=issueatlas-dev_default
id=$(docker network inspect --format '{{.Id}}' "$network")
subnet=$(docker network inspect --format '{{(index .IPAM.Config 0).Subnet}}' "$network")
bridge="br-$(printf '%s' "$id" | cut -c1-12)"
external=$(ip -4 -o route show default | awk 'NR == 1 {print $5}')
test -n "$external"
ip link show "$bridge" >/dev/null
ensure_rule() {
    iptables --wait -C DOCKER-USER "$@" 2>/dev/null ||
        iptables --wait -I DOCKER-USER 1 "$@"
}
ensure_rule -i "$bridge" -s "$subnet" -o "$external" -j ACCEPT
ensure_rule -i "$external" -o "$bridge" -d "$subnet" \
    -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
