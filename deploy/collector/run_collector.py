#!/usr/bin/python3
"""Root-owned manual entry point. Resolve the published digest once and lock collection."""

import argparse
import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

MODES = {
    "kosis": ("pipeline.collect",),
    "airkorea-stations": ("pipeline.collect.airkorea_cli", "stations"),
    "airkorea-final": ("pipeline.collect.airkorea_cli", "final"),
}


def published_image(config):
    current = Path(config["app_dir"]) / ".deploy/collector/current.json"
    record = json.loads(current.read_text())
    if not re.fullmatch(
        re.escape(config["collector_image_repository"]) + r"@sha256:[0-9a-f]{64}",
        record.get("image", ""),
    ):
        raise ValueError("Collector release must use the configured repository digest")
    return record


def command(app, mode, arguments):
    return [
        "docker",
        "compose",
        "--env-file",
        "/dev/null",
        "-f",
        str(Path(app) / "deploy/collector/compose.yaml"),
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "--pull",
        "never",
        "--entrypoint",
        "python",
        "collector",
        "-m",
        *MODES[mode],
        *arguments,
    ]


def main(argv=None):
    import fcntl

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=MODES)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    if any(value == "--output" or value.startswith("--output=") for value in args.arguments):
        parser.error("Output paths are assigned by this runner")
    config = json.loads(Path("/etc/issueatlas/cicd.json").read_text())
    lock_path = Path(config["app_dir"]) / ".deploy/collector/run.lock"
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another collector is already running") from None
        release = published_image(config)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
        output = Path("/var/lib/issueatlas/collector/output") / stamp
        output.mkdir(mode=0o700)
        os.chown(output, 10001, 10001)
        logs = Path("/var/log/issueatlas/collector")
        log = logs / f"{stamp}.log"
        metadata = {"mode": args.mode, "image": release["image"], "revision": release["revision"]}
        env = dict(os.environ, COLLECTOR_IMAGE=release["image"])
        with log.open("x") as stream:
            log.chmod(0o600)
            result = subprocess.run(
                command(
                    config["app_dir"],
                    args.mode,
                    [*args.arguments, "--output", f"/app/outputs/{stamp}/c1.json"],
                ),
                stdout=stream,
                stderr=subprocess.STDOUT,
                env=env,
                check=False,
            )
        metadata["exit_code"] = result.returncode
        summary = logs / f"{stamp}.json"
        summary.write_text(json.dumps(metadata, sort_keys=True) + "\n")
        summary.chmod(0o600)
        print(json.dumps({**metadata, "log": str(log), "output": str(output)}))
        return result.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    except (OSError, ValueError):
        raise SystemExit("Collector not ready; check release, configuration and run lock") from None
