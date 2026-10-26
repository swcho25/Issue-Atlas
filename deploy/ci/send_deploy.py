"""Send one release request over verified SSH; never print keys or registry credentials."""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path


def required(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"Required CI variable missing: {name}")
    return value


def main():
    if required("CI_PIPELINE_SOURCE") != "push":
        raise ValueError("Deployments require a merged branch pipeline")
    branch = required("CI_COMMIT_BRANCH")
    if branch not in {"develop", "main"} or required("CI_COMMIT_REF_PROTECTED") != "true":
        raise ValueError("Only protected develop/main may deploy")
    host, user = required("DEPLOY_HOST"), required("DEPLOY_USER")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", host) or not re.fullmatch(r"[a-z_][a-z0-9_-]*", user):
        raise ValueError("Invalid SSH destination")
    image = Path("backend-image.txt").read_text().strip()
    repository = required("BACKEND_IMAGE_REPOSITORY")
    if not re.fullmatch(re.escape(repository) + r"@sha256:[0-9a-f]{64}", image):
        raise ValueError("Image artifact must contain this project's immutable digest")
    request = {
        "image": image,
        "revision": required("CI_COMMIT_SHA"),
        "branch": branch,
        "pipeline_id": int(required("CI_PIPELINE_ID")),
        "registry_user": required("DOCKERHUB_USERNAME"),
        "registry_password": required("DOCKERHUB_PULL_TOKEN"),
    }
    # CI 변수는 File 형식이며 키는 작업 로그나 아티팩트에 남기지 않는다.
    with tempfile.TemporaryDirectory() as tmp:
        key = Path(tmp) / "identity"
        key.write_bytes(Path(required("SSH_PRIVATE_KEY")).read_bytes())
        key.chmod(0o600)
        known_hosts = Path(required("SSH_KNOWN_HOSTS")).resolve()
        subprocess.run(
            [
                "ssh",
                "-i",
                str(key),
                "-o",
                "BatchMode=yes",
                "-o",
                "IdentitiesOnly=yes",
                "-o",
                "StrictHostKeyChecking=yes",
                "-o",
                "ConnectTimeout=15",
                "-o",
                f"UserKnownHostsFile={known_hosts}",
                f"{user}@{host}",
            ],
            input=json.dumps(request),
            text=True,
            check=True,
            timeout=1200,
        )


if __name__ == "__main__":
    main()
