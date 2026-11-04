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


def environment_config(config, branch):
    """The server owns all paths; a request can select only its branch's environment."""
    if branch not in {"develop", "main"}:
        raise ValueError("Unsupported branch")
    environments = config.get("environments")
    if not environments or branch not in environments:
        raise ValueError("Branch environment is not configured")
    return {**config, **environments[branch], "branch": branch}


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


# Compose interpolates every service, even ones a command does not target. Until the first engine
# release, this placeholder lets backend deployments pass; `--no-deps backend` never starts it.
ENGINE_NOT_DEPLOYED = "issueatlas-engine:not-deployed"


class Deployment:
    service = "backend"
    image_variable = "BACKEND_IMAGE"

    def __init__(self, config):
        self.config = config
        self.app = Path(config["app_dir"])
        self.state = self.app / ".deploy"
        self.state.mkdir(mode=0o700, exist_ok=True)
        self.env = dict(os.environ)
        self.env.update(self.released_images())
        self.compose = ["docker", "compose", "--env-file", str(self.app / "deploy/dev/.env")]
        files = config.get(
            "compose_files", ("compose.yaml", "compose.tunnel.yaml", "compose.release.yaml")
        )
        for name in files:
            self.compose += ["-f", str(self.app / "deploy/dev" / name)]

    def released_images(self):
        """Current digests of the compose.release.yaml services, from their release records."""
        images = {"ENGINE_IMAGE": ENGINE_NOT_DEPLOYED}
        for variable, record in (
            ("BACKEND_IMAGE", self.app / ".deploy/current.json"),
            ("ENGINE_IMAGE", self.app / ".deploy/engine/current.json"),
        ):
            if record.exists():
                images[variable] = json.loads(record.read_text())["image"]
        return images

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
        container = self.run(*self.compose, "ps", "-q", self.service)
        if not container:
            return None
        return json.loads(self.run("docker", "inspect", container, timeout=30))[0]["Image"]

    def apply(self, image):
        if image is None:
            self.run(*self.compose, "stop", self.service)
            return
        self.env[self.image_variable] = image
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
            self.service,
            timeout=150,
        )

    def healthy(self):
        for _ in range(12):
            try:
                local_url = self.config.get(
                    "local_health_url", "http://127.0.0.1:8080/actuator/health"
                )
                for url in (local_url, self.config["health_url"]):
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
        if self.config.get("branch", request["branch"]) != request["branch"]:
            raise ValueError("Deployment branch does not match the selected environment")
        # Each environment has its own app_dir, lock and watermark.
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
        self.env[self.image_variable] = request["image"]
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
        if labels.get("org.opencontainers.image.component", "backend") != request.get(
            "component", "backend"
        ):
            raise RuntimeError("Image component label mismatch")
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
                if previous_image is not None:
                    self.healthy()
                result["rollback"] = (
                    "restored" if previous_image is not None else "no_previous_release"
                )
                if previous_state is not None:
                    write_json(previous_state_file, previous_state)
                elif previous_state_file.exists():
                    previous_state_file.unlink()
            finally:
                write_json(self.state / "last-result.json", result)
            raise RuntimeError(
                f"Deployment failed; inspect {self.state / 'last-result.json'} and job logs"
            ) from None
        component = request.get("component", "backend")
        prefix = "" if component == "backend" else f"{component} "
        print(
            f"Deployed {prefix}{request['branch']} {request['revision']} "
            f"(pipeline {request['pipeline_id']})"
        )


class EngineDeployment(Deployment):
    """Argument phrasing API (engine/api). No host port: trust the compose /health healthcheck."""

    service = "engine"
    image_variable = "ENGINE_IMAGE"

    def __init__(self, config):
        super().__init__(config)
        self.state = self.state / "engine"
        self.state.mkdir(mode=0o700, exist_ok=True)

    def healthy(self):
        container = self.run(*self.compose, "ps", "-q", self.service)
        status = ""
        if container:
            status = self.run(
                "docker", "inspect", "--format", "{{.State.Health.Status}}", container, timeout=30
            )
        if status != "healthy":
            raise RuntimeError("Engine health check failed")


class CollectorDeployment(Deployment):
    """Publish an immutable collector reference; never run collection during deployment."""

    def __init__(self, config):
        super().__init__(config)
        self.state = self.state / "collector"
        self.state.mkdir(mode=0o700, exist_ok=True)
        self.candidate = None

    def current_image(self):
        current = self.state / "current.json"
        reference = self.candidate
        if reference is None and current.exists():
            reference = json.loads(current.read_text())["image"]
        return self.inspect(reference)["Id"] if reference else None

    def apply(self, image):
        if image is not None:
            self.run(
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                "--read-only",
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges:true",
                "--memory",
                "512m",
                "--cpus",
                "1",
                "--pids-limit",
                "128",
                "--tmpfs",
                "/tmp:rw,nosuid,nodev,size=64m,mode=1777",
                "--entrypoint",
                "python",
                image,
                "-m",
                "pipeline.collect",
                "--help",
                timeout=60,
            )
        self.candidate = image

    def healthy(self):
        # apply() already validated imports with no network, credentials or host mounts.
        pass


def deployment_for(config, component):
    """Pick the handler for one environment's config (already narrowed by environment_config)."""
    if component == "collector":
        return CollectorDeployment(
            {**config, "image_repository": config["collector_image_repository"]}
        )
    if component == "engine":
        # Opt-in per environment: only environments with engine_image_repository run the API.
        if not config.get("engine_image_repository"):
            raise ValueError("Engine is not configured for this environment")
        return EngineDeployment({**config, "image_repository": config["engine_image_repository"]})
    if component == "backend":
        return Deployment(config)
    raise ValueError("Unsupported deployment component")


def main():
    import fcntl  # Linux-only deployment lock; the module is importable for local unit tests.

    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/issueatlas/cicd.json")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    raw = sys.stdin.read(16385)
    if len(raw) > 16384:
        raise ValueError("Release request too large")
    request = json.loads(raw)
    config = environment_config(config, request.get("branch"))
    deployment = deployment_for(config, request.get("component", "backend"))
    # Serialize both kinds of deployment; their release records/watermarks stay separate.
    with (Path(config["app_dir"]) / ".deploy/lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        deployment.release(request)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never dump the request (which contains registry credentials).
        print(f"Deployment stopped: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
