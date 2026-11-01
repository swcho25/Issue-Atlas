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
    "press": ("pipeline.collect.press",),
    "lofin": ("pipeline.collect.lofin",),
    "youth-policy": ("pipeline.collect.youth_policy",),
    "bigkinds": ("pipeline.collect.bigkinds",),
    # P2 정제: 장부(raw_record.c1_record) → normalized_record. 키 없음, DB 칸만 쓴다
    "refine": ("pipeline.refine", "--db"),
    # 기존 대응 후보: 정제된 온통청년 정책 · local_expenditure → existing_response. 키 없음, refine 뒤에 돈다
    "responses": ("pipeline.responses", "--db"),
}
# 결과 파일이 없는 모드. --output 을 붙이면 사용법 오류로 끝난다
NO_OUTPUT = {"refine", "responses"}


def published_image(config):
    current = Path(config["app_dir"]) / ".deploy/collector/current.json"
    record = json.loads(current.read_text())
    if not re.fullmatch(
        re.escape(config["collector_image_repository"]) + r"@sha256:[0-9a-f]{64}",
        record.get("image", ""),
    ):
        raise ValueError("Collector release must use the configured repository digest")
    return record


def run_arguments(mode, arguments, stamp):
    """사람이 준 인자 + 실행마다 정하는 결과 파일. 결과 파일이 없는 모드에는 붙이지 않는다."""
    if mode in NO_OUTPUT:
        return list(arguments)
    return [*arguments, "--output", f"/app/outputs/{stamp}/c1.json"]


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
    parser.add_argument("--environment", choices=("develop", "main"), default="develop")
    parser.add_argument("mode", choices=MODES)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    if any(value == "--output" or value.startswith("--output=") for value in args.arguments):
        parser.error("Output paths are assigned by this runner")
    config = json.loads(Path("/etc/issueatlas/cicd.json").read_text())
    config = {**config, **config["environments"][args.environment]}
    lock_path = Path(config["app_dir"]) / ".deploy/collector/run.lock"
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another collector is already running") from None
        release = published_image(config)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
        output = Path(config["collector_output_dir"]) / stamp
        output.mkdir(mode=0o700)
        os.chown(output, 10001, 10001)
        logs = Path(config["collector_log_dir"])
        log = logs / f"{stamp}.log"
        metadata = {
            "environment": args.environment,
            "mode": args.mode,
            "image": release["image"],
            "revision": release["revision"],
        }
        env = dict(
            os.environ,
            COLLECTOR_IMAGE=release["image"],
            COLLECTOR_PROJECT_NAME=f"issueatlas-collector-{args.environment}",
        )
        for key in (
            "collector_env_file", "collector_input_dir", "collector_output_dir", "collector_network"
        ):
            env[key.upper()] = config[key]
        with log.open("x") as stream:
            log.chmod(0o600)
            result = subprocess.run(
                command(
                    config["app_dir"],
                    args.mode,
                    run_arguments(args.mode, args.arguments, stamp),
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
