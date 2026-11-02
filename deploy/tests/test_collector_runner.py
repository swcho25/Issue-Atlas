import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

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
        self.assertIn("--rm", command)
        self.assertIn("never", command)

    def test_successful_collection_refines_only_changed_sources(self):
        started = "2026-11-02T06:00:00+00:00"
        self.assertEqual(
            runner.refine_after("press", 0, started), ["--changed-since", started]
        )
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
        self.assertEqual(
            runner.run_arguments("youth-policy", ["--regions", "12130"], "T"),
            ["--regions", "12130", "--output", "/app/outputs/T/c1.json"],
        )
