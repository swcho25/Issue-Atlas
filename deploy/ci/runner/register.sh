#!/bin/sh
# Run as root on EC2. The Runner authentication token is read from stdin, never a CLI argument.
set -eu
umask 077
log=/etc/issueatlas/runner/registration.log
if test -s /etc/issueatlas/runner/config.toml; then
    echo 'Runner config already exists; refusing to register again.' >&2
    exit 1
fi
if ! docker -H unix:///run/docker-ci.sock run --rm -i \
    -v /etc/issueatlas/runner:/etc/gitlab-runner \
    --entrypoint /bin/sh \
    gitlab/gitlab-runner:alpine@sha256:86a371df46b076bb4c510bca1751d428177d2567bd88e4047613bc7fa92d1a0e \
    -ec 'IFS= read -r CI_SERVER_TOKEN; CI_SERVER_TOKEN=$(printf "%s" "$CI_SERVER_TOKEN" | tr -d "\r"); export CI_SERVER_TOKEN; exec gitlab-runner register --non-interactive --url https://lab.ssafy.com/ --executor docker --docker-image python:3.13-slim-bookworm --name "IssueAtlas EC2 Runner"' \
    >"$log" 2>&1; then
    echo 'Runner registration failed; protected diagnostic log retained on EC2.' >&2
    exit 1
fi
python3 - <<'PY'
from pathlib import Path
import tomllib

root = Path('/etc/issueatlas/runner')
target = root / 'config.toml'
registered = target.read_text()
original = tomllib.loads(registered)['runners'][0]
metadata = []
for line in registered.split('[[runners]]', 1)[1].splitlines():
    if line.strip().startswith('['):
        break
    if line.strip().split('=', 1)[0].strip() in {
        'id', 'token', 'token_obtained_at', 'token_expires_at'
    }:
        metadata.append(line)
template = (root / 'config.template.toml').read_text()
configured = template.replace('[[runners]]', '[[runners]]\n' + '\n'.join(metadata), 1)
parsed = tomllib.loads(configured)
assert parsed['runners'][0]['token'] == original['token']
assert parsed['concurrent'] == 1
target.write_text(configured)
target.chmod(0o600)
PY
rm -f "$log"
echo 'Runner registered; concurrency and resource limits configured.'
