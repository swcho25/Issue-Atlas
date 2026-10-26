"""Root-owned forced SSH command on EC2. Accept a bounded release request on stdin."""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


def validate_request(request, repository):
    if request.get("branch") not in {"develop", "main"}:
        raise ValueError("Unsupported branch")
    if type(request.get("pipeline_id")) is not int or request["pipeline_id"] < 1:
        raise ValueError("Invalid pipeline ID")
    if not re.fullmatch(r"[0-9a-f]{40}", request.get("revision", "")):
        raise ValueError("Invalid revision")
    if not re.fullmatch(re.escape(repository) + r"@sha256:[0-9a-f]{64}", request.get("image", "")):
        raise ValueError("Image must belong to the configured repository and use a digest")
    if not request.get("registry_user") or not request.get("registry_password"):
        raise ValueError("Missing registry credentials")


def write_json(path, value):
    pending = path.with_suffix(".pending")
    pending.write_text(json.dumps(value, sort_keys=True) + "\n")
    pending.chmod(0o600)
    pending.replace(path)


class Deployment:
    def __init__(self, config):
        self.config = config
        self.app = Path(config["app_dir"])
        self.state = self.app / ".deploy"
        self.state.mkdir(mode=0o700, exist_ok=True)
        self.env = dict(os.environ)
        self.compose = ["docker", "compose", "--env-file", str(self.app / "deploy/dev/.env")]
        for name in ("compose.yaml", "compose.tunnel.yaml", "compose.release.yaml"):
            self.compose += ["-f", str(self.app / "deploy/dev" / name)]

    def run(self, *args, input=None, timeout=180):
        result = subprocess.run(
            args,
            input=input,
            text=True,
            capture_output=True,
            env=self.env,
            timeout=timeout,
            check=False,
        )
        if result.returncode:
            # Docker stderr may contain endpoint/credential data; use a fixed diagnostic.
            raise RuntimeError(f"Command failed: {args[0]}")
        return result.stdout.strip()

    def inspect(self, image):
        return json.loads(self.run("docker", "image", "inspect", image))[0]

    def current_image(self):
        container = self.run(*self.compose, "ps", "-q", "backend")
        if not container:
            raise RuntimeError("Existing backend required for rollback")
        return json.loads(self.run("docker", "inspect", container, timeout=30))[0]["Image"]

    def apply(self, image):
        self.env["BACKEND_IMAGE"] = image
        self.run(*self.compose, "config", "--quiet")
        self.run(
            *self.compose,
            "up",
            "-d",
            "--no-deps",
            "--no-build",
            "--pull",
            "never",
            "--wait",
            "--wait-timeout",
            "120",
            "backend",
            timeout=150,
        )

    def healthy(self):
        for _ in range(12):
            try:
                for url in ("http://127.0.0.1:8080/actuator/health", self.config["health_url"]):
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "IssueAtlasDeploymentCheck/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        if json.load(response).get("status") != "UP":
                            raise RuntimeError("Health is not UP")
                        if response.headers.get("CF-Cache-Status", "").upper() == "HIT":
                            raise RuntimeError("Cached health response")
                return
            except Exception:
                time.sleep(2)
        raise RuntimeError("Internal or external HTTPS health check failed")

    def release(self, request):
        validate_request(request, self.config["image_repository"])
        # One shared watermark across main/develop. Even a failed newer attempt blocks older jobs.
        watermark = self.state / "watermark.json"
        previous_attempt = json.loads(watermark.read_text()) if watermark.exists() else {}
        if request["pipeline_id"] < previous_attempt.get("pipeline_id", 0):
            raise RuntimeError("Outdated pipeline rejected")
        if request["pipeline_id"] == previous_attempt.get("pipeline_id") and (
            request["revision"] != previous_attempt.get("revision")
            or request["image"] != previous_attempt.get("image")
        ):
            raise RuntimeError("Pipeline retry changed its release identity")
        metadata = {key: request[key] for key in ("image", "revision", "branch", "pipeline_id")}
        write_json(watermark, metadata)
        self.env["BACKEND_IMAGE"] = request["image"]
        previous_image = self.current_image()
        previous_state_file = self.state / "current.json"
        previous_state = (
            json.loads(previous_state_file.read_text()) if previous_state_file.exists() else None
        )
        # Discard the temporary Docker login after pulling; never persist the access token.
        with tempfile.TemporaryDirectory(prefix="issueatlas-registry-") as tmp:
            self.env["DOCKER_CONFIG"] = tmp
            registry = (
                self.config.get("registry_host") or self.config["image_repository"].split("/", 1)[0]
            )
            self.run(
                "docker",
                "login",
                registry,
                "-u",
                request["registry_user"],
                "--password-stdin",
                input=request["registry_password"] + "\n",
                timeout=30,
            )
            self.run("docker", "pull", request["image"])
        self.env.pop("DOCKER_CONFIG", None)
        image = self.inspect(request["image"])
        labels = image["Config"].get("Labels") or {}
        if labels.get("org.opencontainers.image.revision") != request["revision"]:
            raise RuntimeError("Image revision label mismatch")
        if labels.get("org.opencontainers.image.source") != self.config["project_url"]:
            raise RuntimeError("Image project label mismatch")
        try:
            self.apply(request["image"])
            self.healthy()
            if self.current_image() != image["Id"]:
                raise RuntimeError("Running image differs from requested release")
            write_json(previous_state_file, metadata)
            write_json(self.state / "last-result.json", {**metadata, "status": "success"})
        except Exception:
            result = {**metadata, "status": "failed", "rollback": "failed"}
            try:
                self.apply(previous_image)
                self.healthy()
                result["rollback"] = "restored"
                if previous_state is not None:
                    write_json(previous_state_file, previous_state)
                elif previous_state_file.exists():
                    previous_state_file.unlink()
            finally:
                write_json(self.state / "last-result.json", result)
            raise RuntimeError(
                "Deployment failed; inspect .deploy/last-result.json and backend logs"
            ) from None
        print(
            f"Deployed {request['branch']} {request['revision']} "
            f"(pipeline {request['pipeline_id']})"
        )


def main():
    import fcntl  # Linux-only deployment lock; the module is importable for local unit tests.

    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/issueatlas/cicd.json")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    deployment = Deployment(config)
    raw = sys.stdin.read(16385)
    if len(raw) > 16384:
        raise ValueError("Release request too large")
    request = json.loads(raw)
    with (deployment.state / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        deployment.release(request)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never dump the request (which contains registry credentials).
        print(f"Deployment stopped: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
