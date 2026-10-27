import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "collector_release", Path(__file__).resolve().parents[1] / "ci/deploy_backend.py"
)
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)
REPO = "registry.example/team/collector"
IMAGE = REPO + "@sha256:" + "a" * 64


class FakeCollector(deploy.CollectorDeployment):
    def __init__(self, root):
        super().__init__({"app_dir": root, "image_repository": REPO, "project_url": "https://p"})
        self.commands = []
        self.fail_help = False
        self.component = "collector"

    def run(self, *args, **kwargs):
        self.commands.append(args)
        if args[:2] == ("docker", "run") and self.fail_help and args[-4] == IMAGE:
            raise RuntimeError("Import failed")
        return ""

    def inspect(self, reference):
        return {
            "Id": "sha256:new" if reference == IMAGE else "sha256:old",
            "Config": {
                "Labels": {
                    "org.opencontainers.image.revision": "b" * 40,
                    "org.opencontainers.image.source": "https://p",
                    "org.opencontainers.image.component": self.component,
                }
            },
        }


class CollectorReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.release = FakeCollector(self.temp.name)
        self.request = {
            "component": "collector",
            "branch": "develop",
            "pipeline_id": 10,
            "revision": "b" * 40,
            "image": IMAGE,
            "registry_user": "test",
            "registry_password": "not-a-real-token",
        }

    def publish(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.release.release(self.request)

    def test_first_publication_never_collects_or_mounts_credentials(self):
        self.publish()
        state = json.loads((self.release.state / "current.json").read_text())
        self.assertEqual(state["image"], IMAGE)
        smoke = next(c for c in self.release.commands if c[:2] == ("docker", "run"))
        self.assertEqual(smoke[-3:], ("-m", "pipeline.collect", "--help"))
        self.assertIn("none", smoke)
        self.assertNotIn("-v", smoke)
        self.assertFalse(any("compose" in c for c in self.release.commands))
        self.assertFalse((Path(self.temp.name) / ".deploy/current.json").exists())

    def test_failed_first_smoke_does_not_publish_a_version(self):
        self.release.fail_help = True
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertFalse((self.release.state / "current.json").exists())

    def test_failed_update_preserves_previous_reference(self):
        old = {**self.request, "image": REPO + "@sha256:" + "c" * 64, "pipeline_id": 9}
        deploy.write_json(self.release.state / "current.json", old)
        self.release.fail_help = True
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertEqual(json.loads((self.release.state / "current.json").read_text()), old)

    def test_backend_image_cannot_be_published_as_collector(self):
        self.release.component = "backend"
        with self.assertRaisesRegex(RuntimeError, "component"):
            self.publish()
        self.assertFalse((self.release.state / "current.json").exists())

    def test_older_pipeline_cannot_replace_published_collector(self):
        self.publish()
        self.request["pipeline_id"] = 9
        with self.assertRaisesRegex(RuntimeError, "Outdated"):
            self.publish()
