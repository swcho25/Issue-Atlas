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
    # P3: 아직 지역 · 시간을 안 정한 기사 → 추출기 입력(본문 포함 JSONL). 키 없음
    "region-export": ("pipeline.region.export", "--db"),
    # P3: 내보낸 기사(/inputs) → 모델 서버(collector.env 의 P3_LLM_*)에 지역 · 요약 질문 → 추출 결과 JSONL
    "region-extract": ("pipeline.region.extract",),
    # P3: 추출 결과(/inputs) → news_event, --delete-bodies 로 요약된 기사 본문 지우기. 기본 시험 실행
    "region-load": ("pipeline.region.load", "--db"),
}
# 결과 파일이 없는 모드. --output 을 붙이면 사용법 오류로 끝난다
NO_OUTPUT = {"refine", "responses", "region-load"}
# 결과 파일이 C1 이 아닌 모드의 파일 이름
OUTPUT_NAME = {"region-export": "articles.jsonl", "region-extract": "extract.jsonl"}
# 원본 장부(raw_record)에 쓰는 수집 모드. 성공하면 같은 잠금 안에서 바뀐 출처만 정제한다.
# lofin 은 자체 표(local_expenditure)라 정제가 없다
REFINE_AFTER = {"kosis", "airkorea-stations", "airkorea-final", "press", "youth-policy", "bigkinds"}


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
    return [*arguments, "--output", f"/app/outputs/{stamp}/{OUTPUT_NAME.get(mode, 'c1.json')}"]


def refine_after(mode, returncode, started):
    """수집이 성공했으면 그 실행 뒤에 실행 이력(job_run)이 생긴 출처만 정제하는 인자, 아니면 None.

    DB 에 쓰지 않은 실행(--db 없는 보도자료 등)은 실행 이력이 없어 정제할 출처도 없다.
    """
    if mode not in REFINE_AFTER or returncode != 0:
        return None
    return ["--changed-since", started]


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
    # 수집 뒤 자동 정제를 끈다. 그 환경의 수집기 이미지에 refine --changed-since 가 없을 때 쓴다
    parser.add_argument("--no-refine", action="store_true")
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
        now = datetime.now(UTC)
        stamp = now.strftime("%Y%m%dT%H%M%S.%fZ")
        # 수집기가 실행 이력에 찍는 시작 시각보다 늦지 않게 초 아래를 버린다
        started = now.replace(microsecond=0).isoformat()
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
            follow = None if args.no_refine else refine_after(args.mode, result.returncode, started)
            if follow is not None:
                stream.flush()
                refined = subprocess.run(
                    command(config["app_dir"], "refine", follow),
                    stdout=stream,
                    stderr=subprocess.STDOUT,
                    env=env,
                    check=False,
                )
                metadata["refine_exit_code"] = refined.returncode
        metadata["exit_code"] = result.returncode
        summary = logs / f"{stamp}.json"
        summary.write_text(json.dumps(metadata, sort_keys=True) + "\n")
        summary.chmod(0o600)
        print(json.dumps({**metadata, "log": str(log), "output": str(output)}))
        return result.returncode or metadata.get("refine_exit_code", 0)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    except (OSError, ValueError):
        raise SystemExit("Collector not ready; check release, configuration and run lock") from None
