import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

SPEC = importlib.util.spec_from_file_location(
    "collector_runner", Path(__file__).resolve().parents[1] / "collector/run_collector.py"
)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class CollectorRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = Path(self.temp.name)
        self.state = self.app / ".deploy/collector/current.json"
        self.state.parent.mkdir(parents=True)
        self.config = {"app_dir": str(self.app), "collector_image_repository": "team/collector"}

    def test_unpublished_collector_cannot_run(self):
        with self.assertRaises(FileNotFoundError):
            runner.published_image(self.config)

    def test_mutable_tag_or_foreign_repository_is_rejected(self):
        for image in ("team/collector:latest", "other/collector@sha256:" + "a" * 64):
            self.state.write_text(json.dumps({"image": image}))
            with self.assertRaises(ValueError):
                runner.published_image(self.config)

    def test_operator_uses_published_digest_and_selected_module(self):
        image = "team/collector@sha256:" + "b" * 64
        self.state.write_text(json.dumps({"image": image, "revision": "c" * 40}))
        record = runner.published_image(self.config)
        self.assertEqual(record["image"], image)
        command = runner.command(self.app, "airkorea-final", ["--xlsx", "/inputs/a.xlsx"])
        self.assertEqual(
            command[-5:],
            ["-m", "pipeline.collect.airkorea_cli", "final", "--xlsx", "/inputs/a.xlsx"],
        )
        self.assertEqual(
            runner.command(self.app, "press", ["--site", "yeosu", "--db"])[-5:],
            ["-m", "pipeline.collect.press", "--site", "yeosu", "--db"],
        )
        self.assertEqual(
            runner.command(self.app, "lofin", ["--xlsx", "/inputs/2025.xlsx", "--db"])[-5:],
            ["-m", "pipeline.collect.lofin", "--xlsx", "/inputs/2025.xlsx", "--db"],
        )
        self.assertEqual(
            runner.command(self.app, "youth-policy", [])[-2:],
            ["-m", "pipeline.collect.youth_policy"],
        )
        self.assertEqual(
            runner.command(self.app, "bigkinds", ["--start", "2025-10-01"])[-4:],
            ["-m", "pipeline.collect.bigkinds", "--start", "2025-10-01"],
        )
        self.assertEqual(
            runner.command(self.app, "refine", [])[-3:], ["-m", "pipeline.refine", "--db"]
        )
        self.assertEqual(
            runner.command(self.app, "responses", [])[-3:], ["-m", "pipeline.responses", "--db"]
        )
        self.assertEqual(
            runner.command(self.app, "syndicate", ["--apply"])[-4:],
            ["-m", "pipeline.refine.syndication", "--db", "--apply"],
        )
        self.assertIn("--rm", command)
        self.assertIn("never", command)

    def test_successful_collection_refines_only_changed_sources(self):
        started = "2026-11-02T06:00:00+00:00"
        self.assertEqual(runner.refine_after("press", 0, started), ["--changed-since", started])
        self.assertEqual(
            runner.command(self.app, "refine", ["--changed-since", started])[-5:],
            ["-m", "pipeline.refine", "--db", "--changed-since", started],
        )
        # 실패한 수집 · 정제 자체 · 정제가 없는 세출은 뒤따르는 정제가 없다
        self.assertIsNone(runner.refine_after("bigkinds", 1, started))
        self.assertIsNone(runner.refine_after("refine", 0, started))
        self.assertIsNone(runner.refine_after("responses", 0, started))
        self.assertIsNone(runner.refine_after("lofin", 0, started))

    def test_refine_gets_no_output_path_but_collectors_do(self):
        # pipeline.refine 은 --db 하나만 받는다. --output 을 붙이면 사용법 오류(종료 코드 2)
        self.assertEqual(runner.run_arguments("refine", [], "T"), [])
        self.assertEqual(runner.run_arguments("responses", [], "T"), [])
        # 전재 묶기도 결과 파일 없이 DB 만 쓴다
        self.assertEqual(runner.run_arguments("syndicate", ["--apply"], "T"), ["--apply"])
        self.assertIsNone(runner.refine_after("syndicate", 0, "2026-11-05T00:00:00+00:00"))
        self.assertEqual(
            runner.run_arguments("region-load", ["--delete-bodies"], "T"), ["--delete-bodies"]
        )
        self.assertEqual(
            runner.run_arguments("region-export", [], "T"),
            ["--output", "/app/outputs/T/articles.jsonl"],
        )
        self.assertEqual(
            runner.run_arguments("region-extract", ["--input", "/inputs/a.jsonl"], "T"),
            ["--input", "/inputs/a.jsonl", "--output", "/app/outputs/T/extract.jsonl"],
        )
        self.assertEqual(
            runner.run_arguments("youth-policy", ["--regions", "12130"], "T"),
            ["--regions", "12130", "--output", "/app/outputs/T/c1.json"],
        )

    def test_only_committed_summary_load_starts_classification(self):
        result = {"apply": True, "load": {"inserted": 1, "summarized": 1}}
        args = ["--extract", "/inputs/a.jsonl", "--apply"]
        self.assertTrue(runner.should_classify("region-load", args, 0, result))
        for mode, arguments, code, payload in (
            ("region-load", args[:-1], 0, result),  # 시험 실행
            ("region-load", ["--delete-bodies", "--apply"], 0, result),
            ("region-load", ["--relocate", "--apply"], 0, result),
            ("region-load", args, 1, result),
            ("region-load", args, 0, {"apply": True, "load": {"summarized": 0}}),
            ("region-load", args, 0, {"apply": True, "load": {"skipped": {"보류": 1}}}),
            ("region-load", args, 0, None),
        ):
            with self.subTest(arguments=arguments, code=code, payload=payload):
                self.assertFalse(runner.should_classify(mode, arguments, code, payload))

    def test_classify_checks_count_and_stops_at_limit_without_embedding(self):
        called = []

        def run(command, **kwargs):
            called.append(command[command.index("-m") + 2])
            return SimpleNamespace(returncode=0, stdout='{"eligible": 240, "new_embeddings": 180}')

        code, steps = runner.run_classification(self.app, {}, io.StringIO(), run=run)
        self.assertEqual(code, 3)
        self.assertEqual(called, ["count-docs"])
        self.assertEqual(steps["count-docs"]["reason"], "new_embeddings_limit_exceeded")
        self.assertEqual(steps["embed-docs"], {"status": "skipped"})

    def test_classify_failure_stops_next_stage_and_retry_reuses_cache(self):
        called = []
        outputs = {
            "count-docs": '{"eligible": 1, "new_embeddings": 0, "cached_embeddings": 1}',
            "embed-docs": '{"eligible": 1, "already_active": 1}',
            "embed-cards": '{"approved": 2, "already_active": 2}',
            "score": '{"scores": {"C1": 1}, "selected": {"C1": 1}}',
        }
        fail_card = True

        def run(command, **kwargs):
            mode = command[command.index("-m") + 2]
            called.append(mode)
            code = 1 if mode == "embed-cards" and fail_card else 0
            return SimpleNamespace(returncode=code, stdout="card failed" if code else outputs[mode])

        code, steps = runner.run_classification(self.app, {}, io.StringIO(), run=run)
        self.assertEqual(code, 1)
        self.assertEqual(called, ["count-docs", "embed-docs", "embed-cards"])
        self.assertEqual(steps["score"], {"status": "skipped"})
        called.clear()
        fail_card = False
        code, steps = runner.run_classification(self.app, {}, io.StringIO(), run=run)
        self.assertEqual(code, 0)
        self.assertEqual(called, ["count-docs", "embed-docs", "embed-cards", "score"])
        self.assertEqual(steps["embed-docs"]["result"]["already_active"], 1)
