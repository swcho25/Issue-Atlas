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
        self.assertIn("--rm", command)
        self.assertIn("never", command)
