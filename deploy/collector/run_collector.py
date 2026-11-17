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
    # 기존 대응 후보: 정제된 정책 · local_expenditure → existing_response. refine 뒤에 돈다
    "responses": ("pipeline.responses", "--db"),
    # P2 전재 묶기: 정제된 최신 기사 → news_syndication 재계산. 기본 시험 실행
    "syndicate": ("pipeline.refine.syndication", "--db"),
    # P3: 아직 지역 · 시간을 안 정한 기사 → 추출기 입력(본문 포함 JSONL). 키 없음
    "region-export": ("pipeline.region.export", "--db"),
    # P3: 내보낸 기사 → 모델 서버(P3_LLM_*)에 지역·요약 질문 → 결과 JSONL
    "region-extract": ("pipeline.region.extract",),
    # P3: 추출 결과 → news_event. --delete-bodies 는 본문 지우기. 기본 시험 실행
    "region-load": ("pipeline.region.load", "--db"),
    # P4: 승인 카드와 최신 정제 기사만 분류. 세 모드 모두 --apply에서만 DB 저장
    "embed-docs": ("ai.classify", "embed-docs", "--db"),
    "count-docs": ("ai.classify", "count-docs", "--db"),
    "embed-cards": ("ai.classify", "embed-cards", "--db"),
    "score": ("ai.classify", "score", "--db"),
}
# 결과 파일이 없는 모드. --output 을 붙이면 사용법 오류로 끝난다
NO_OUTPUT = {
    "refine",
    "responses",
    "syndicate",
    "region-load",
    "count-docs",
    "embed-docs",
    "embed-cards",
    "score",
}
CLASSIFY_STEPS = ("embed-docs", "embed-cards", "score")
MAX_NEW_DOCS = 100
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


def logged_step(app, mode, arguments, env, stream, capture=False, run=subprocess.run):
    """같은 실행 로그에 단계와 출력을 남긴다. JSON이 필요한 단계만 출력을 읽는다."""
    stream.write(f"\n[{mode}]\n")
    stream.flush()
    result = run(
        command(app, mode, arguments),
        stdout=subprocess.PIPE if capture else stream,
        stderr=subprocess.STDOUT,
        env=env,
        check=False,
        **({"text": True} if capture else {}),
    )
    if not capture:
        return result.returncode, None
    stream.write(result.stdout or "")
    stream.flush()
    try:
        payload = (
            json.loads((result.stdout or "").splitlines()[-1]) if result.returncode == 0 else None
        )
    except (IndexError, json.JSONDecodeError):
        payload = None
    return result.returncode, payload


def should_classify(mode, arguments, exit_code, payload):
    """P3 요약이 커밋된 적재만 자동 분류한다."""
    return (
        mode == "region-load"
        and exit_code == 0
        and "--apply" in arguments
        and ("--extract" in arguments or any(a.startswith("--extract=") for a in arguments))
        and isinstance(payload, dict)
        and payload.get("apply") is True
        and isinstance(payload.get("load"), dict)
        and payload["load"].get("summarized", 0) > 0
    )


def run_classification(app, env, stream, max_new_docs=MAX_NEW_DOCS, run=subprocess.run):
    """API 호출 전 신규 건수를 검사하고, 실패한 단계 뒤는 실행하지 않는다."""
    steps = {}
    code, pending = logged_step(app, "count-docs", [], env, stream, capture=True, run=run)
    steps["count-docs"] = {"exit_code": code, "result": pending}
    if code == 0 and (
        not isinstance(pending, dict)
        or not isinstance(pending.get("new_embeddings"), int)
        or pending["new_embeddings"] < 0
    ):
        code = 1
        steps["count-docs"]["exit_code"] = code
        steps["count-docs"]["reason"] = "invalid_count_result"
    elif code == 0 and pending["new_embeddings"] > max_new_docs:
        code = 3
        steps["count-docs"]["reason"] = "new_embeddings_limit_exceeded"
        steps["count-docs"]["limit"] = max_new_docs
        stream.write(
            f"new_embeddings={pending['new_embeddings']} exceeds limit={max_new_docs}; "
            "classification stopped\n"
        )
    if code:
        for mode in CLASSIFY_STEPS:
            steps[mode] = {"status": "skipped"}
        return code, steps
    for index, mode in enumerate(CLASSIFY_STEPS):
        code, result = logged_step(app, mode, ["--apply"], env, stream, capture=True, run=run)
        if code == 0 and not isinstance(result, dict):
            code = 1
        steps[mode] = {"exit_code": code, "result": result}
        if code:
            for later in CLASSIFY_STEPS[index + 1 :]:
                steps[later] = {"status": "skipped"}
            return code, steps
    return 0, steps


def main(argv=None):
    import fcntl

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=("develop", "main"), default="develop")
    # 수집 뒤 자동 정제를 끈다. 그 환경의 수집기 이미지에 refine --changed-since 가 없을 때 쓴다
    parser.add_argument("--no-refine", action="store_true")
    parser.add_argument("mode", choices=(*MODES, "classify"))
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    if any(value == "--output" or value.startswith("--output=") for value in args.arguments):
        parser.error("Output paths are assigned by this runner")
    if args.mode == "classify":
        classify_parser = argparse.ArgumentParser(prog="issueatlas-collect classify")
        classify_parser.add_argument("--max-new-docs", type=int, default=MAX_NEW_DOCS)
        classify_args = classify_parser.parse_args(args.arguments)
        if classify_args.max_new_docs < 1:
            classify_parser.error("--max-new-docs must be positive")
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
            "collector_env_file",
            "collector_input_dir",
            "collector_output_dir",
            "collector_network",
        ):
            env[key.upper()] = config[key]
        with log.open("x") as stream:
            log.chmod(0o600)
            if args.mode == "classify":
                code, metadata["classify_steps"] = run_classification(
                    config["app_dir"], env, stream, classify_args.max_new_docs
                )
            else:
                code, payload = logged_step(
                    config["app_dir"],
                    args.mode,
                    run_arguments(args.mode, args.arguments, stamp),
                    env,
                    stream,
                    capture=args.mode in {"region-load", "count-docs"},
                )
                if args.mode == "count-docs":
                    metadata["result"] = payload
            follow = None if args.no_refine else refine_after(args.mode, code, started)
            if follow is not None:
                metadata["refine_exit_code"], _ = logged_step(
                    config["app_dir"], "refine", follow, env, stream
                )
            if args.mode == "region-load" and should_classify(
                args.mode, args.arguments, code, payload
            ):
                metadata["classify_exit_code"], metadata["classify_steps"] = run_classification(
                    config["app_dir"], env, stream
                )
            elif args.mode in {"region-load", "count-docs"} and code == 0 and payload is None:
                code = 1
                metadata["result_error"] = "missing_step_result"
        metadata["exit_code"] = (
            code or metadata.get("refine_exit_code", 0) or metadata.get("classify_exit_code", 0)
        )
        summary = logs / f"{stamp}.json"
        summary.write_text(json.dumps(metadata, sort_keys=True) + "\n")
        summary.chmod(0o600)
        print(json.dumps({**metadata, "log": str(log), "output": str(output)}))
        return metadata["exit_code"]


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    except (OSError, ValueError):
        raise SystemExit("Collector not ready; check release, configuration and run lock") from None
