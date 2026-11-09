"""python -m ai.classify {embed-docs,embed-cards,score,sample} --db · train --input --output."""

import argparse
import csv
import json
import random
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

from . import f4, gms, store
from .model import INPUT_VERSION, PROFILE_VERSION, card_rules, decide, digest

THRESHOLDS = Path(__file__).with_name("thresholds.json")


def choose_sample(rows: list[tuple], count: int = 30) -> list[tuple]:
    """상위·경계·무작위 10건씩. 모자란 그룹은 남은 행으로 채운다."""
    ranked = sorted(rows, key=lambda row: (-row[2], row[1]))
    high = ranked[: count // 3]
    remaining = [row for row in ranked if row not in high]
    near = sorted(remaining, key=lambda row: (abs(row[2] - row[3]), row[1]))[: count // 3]
    remaining = [row for row in remaining if row not in near]
    random_count = min(count - len(high) - len(near), len(remaining))
    random_rows = random.Random(20261103).sample(remaining, random_count)
    return high + near + random_rows


def command_embed_docs(conn, apply: bool, limit: int | None, embed=gms.embed):
    found = store.documents(conn)
    stats = Counter({"eligible": len(found)})
    for item in found[:limit]:
        state = store.current_document(conn, item.input_id)
        if state is True:
            stats["already_active"] += 1
            continue
        vector = embed(item.input_text) if state is None else None
        stats["embedded" if vector is not None else "reactivated"] += 1
        if apply:
            store.save_document(conn, item, vector)
    if apply and limit is None:
        stats["deactivated_missing"] = store.deactivate_missing_documents(
            conn, [item.doc_id for item in found]
        )
    return dict(stats)


def command_embed_cards(conn, apply: bool, embed=gms.embed):
    found = store.cards(conn)
    stats = Counter({"approved": len(found)})
    for card_id, version, text in found:
        state = store.current_card(conn, card_id, version, digest(text))
        if state is True:
            stats["already_active"] += 1
            continue
        vector = embed(text) if state is None else None
        stats["embedded" if vector is not None else "reactivated"] += 1
        if apply:
            store.save_card(conn, card_id, version, text, vector)
    return dict(stats) | {"profile_version": PROFILE_VERSION}


def f4_probabilities(conn, rows, rules, version: str, model_path: Path = f4.MODEL_FILE):
    """f4 카드 행의 (doc_id, card_id) → 확률. 모델 판은 thresholds.json 판과 같아야 한다."""
    cards = {card_id for card_id, rule in rules.items() if rule.method == "f4"}
    if not cards:
        return {}
    classifier = f4.load(model_path)
    if classifier.version != version:
        raise ValueError(
            f"thresholds.json 판({version})과 F4 모델 판({classifier.version})이 다릅니다"
        )
    wanted = defaultdict(list)
    for doc_id, card_id, input_id, *_ in rows:
        if card_id in cards:
            wanted[input_id].append((doc_id, card_id))
    probabilities = {}
    for input_id, text, input_version, embedding in store.score_inputs(conn):
        if input_id not in wanted:
            continue
        if input_version != INPUT_VERSION:
            raise ValueError(f"F4 는 입력 판 {INPUT_VERSION} 만 받습니다: {input_id}")
        for doc_id, card_id in wanted[input_id]:
            probabilities[doc_id, card_id] = classifier.cards[card_id].probability(text, embedding)
    missing = sum(len(keys) for keys in wanted.values()) - len(probabilities)
    if missing:
        raise RuntimeError(f"F4 확률을 구하지 못한 점수 행이 {missing}개 있습니다")
    return probabilities


def command_score(conn, apply: bool, path: Path, model_path: Path = f4.MODEL_FILE):
    config = json.loads(path.read_text(encoding="utf-8"))
    version = config["version"]
    rules = card_rules(config)
    rows = store.scores(conn)
    if not rows:
        raise RuntimeError("활성 기사·카드 임베딩이 없습니다")
    probabilities = f4_probabilities(conn, rows, rules, version, model_path)
    if apply:
        store.save_scores(conn, rows, rules, version, probabilities)
    stats = Counter(card_id for _, card_id, *_ in rows)
    selected = Counter(
        card_id
        for doc_id, card_id, *rest in rows
        if decide(rules[card_id], rest[-1], probabilities.get((doc_id, card_id)))
    )
    return {
        "threshold_version": version,
        "label_status": config.get("label_status"),
        "methods": {card_id: rule.method for card_id, rule in sorted(rules.items())},
        "scores": dict(stats),
        "selected": dict(selected),
    }


def command_train(input_path: Path, output: Path):
    """저장소 밖 학습 입력 JSON → F4 모델 파일. DB · API 를 쓰지 않는다."""
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    model = f4.train(payload)
    f4.parse(model)
    output.write_text(f4.dumps(model), encoding="utf-8")
    return {
        "version": model["version"],
        "output": str(output),
        "cards": {
            card_id: {key: card[key] for key in ("pool_count", "train_count", "positive_count")}
            | {"ngrams": len(card["ngrams"])}
            for card_id, card in model["cards"].items()
        },
    }


def command_sample(conn, output: Path):
    groups = defaultdict(list)
    for row in store.sample_rows(conn):
        groups[row[0]].append(row)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream)
        writer.writerow(
            [
                "card_id",
                "doc_id",
                "similarity",
                "threshold",
                "selected",
                "news_id",
                "summary",
                "input_text",
                "human_label",
            ]
        )
        for card_id in sorted(groups):
            for row in choose_sample(groups[card_id]):
                writer.writerow([*row, ""])
    return {card_id: min(30, len(rows)) for card_id, rows in groups.items()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="기사→C1·A3 분류. --apply에서만 DB를 변경")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("embed-docs", "embed-cards", "score", "sample"):
        sub = commands.add_parser(name)
        sub.add_argument("--db", action="store_true", required=True)
        sub.add_argument("--database", help="로컬 테스트 DB 이름. 생략하면 .env의 DB_NAME")
        if name != "sample":
            sub.add_argument("--apply", action="store_true", help="계산 결과를 DB에 저장")
        if name == "embed-docs":
            sub.add_argument("--limit", type=int)
        if name == "score":
            sub.add_argument("--thresholds", type=Path, default=THRESHOLDS)
        if name == "sample":
            sub.add_argument("--output", type=Path, required=True)
    train = commands.add_parser("train", help="학습 입력 JSON → F4 모델 파일 (scikit-learn 필요)")
    train.add_argument("--input", type=Path, required=True, help="저장소 밖 학습 입력 JSON")
    train.add_argument("--output", type=Path, default=f4.MODEL_FILE)
    args = parser.parse_args(argv)
    started = time.perf_counter()
    try:
        if args.command == "train":
            result = command_train(args.input, args.output)
            print(json.dumps(result, ensure_ascii=False, sort_keys=True))
            return 0
        with store.connect(args.database) as conn:
            if args.command == "embed-docs":
                if args.limit is not None and args.limit < 1:
                    parser.error("--limit는 1 이상이어야 합니다")
                result = command_embed_docs(conn, args.apply, args.limit)
            elif args.command == "embed-cards":
                result = command_embed_cards(conn, args.apply)
            elif args.command == "score":
                result = command_score(conn, args.apply, args.thresholds)
            else:
                result = command_sample(conn, args.output)
        print(
            json.dumps(
                result | {"elapsed_seconds": round(time.perf_counter() - started, 3)},
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except (RuntimeError, ValueError, OSError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
