"""Release state-machine tests: no Docker daemon, database, SSH key or API credentials required."""

import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "ci/deploy_backend.py"
SPEC = importlib.util.spec_from_file_location("deploy_backend", MODULE)
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)
REPOSITORY = "registry.example/team/project/backend"
IMAGE = REPOSITORY + "@sha256:" + "a" * 64
REVISION = "b" * 40


def request(**overrides):
    return {
        "image": IMAGE,
        "revision": REVISION,
        "branch": "develop",
        "pipeline_id": 10,
        "registry_user": "test-user",
        "registry_password": "test-secret",
        **overrides,
    }


class FakeDeployment(deploy.Deployment):
    def __init__(self, root):
        super().__init__(
            {
                "app_dir": root,
                "image_repository": REPOSITORY,
                "project_url": "https://example/project",
            }
        )
        self.running = "sha256:old"
        self.applied = []
        self.fail_new_health = False
        self.fail_rollback = False
        self.fail_pull = False
        self.labels = {
            "org.opencontainers.image.revision": REVISION,
            "org.opencontainers.image.source": "https://example/project",
        }

    def run(self, *args, **kwargs):
        if args[:2] == ("docker", "pull") and self.fail_pull:
            raise RuntimeError("Pull failed")
        return ""

    def current_image(self):
        return self.running

    def inspect(self, image):
        return {"Id": "sha256:new", "Config": {"Labels": self.labels}}

    def apply(self, image):
        self.applied.append(image)
        if image == "sha256:old" and self.fail_rollback:
            raise RuntimeError("Old version incompatible")
        self.running = "sha256:new" if image == IMAGE else image

    def healthy(self):
        if self.running == "sha256:new" and self.fail_new_health:
            raise RuntimeError("New version unhealthy")


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.deployment = FakeDeployment(self.tmp.name)

    def release(self, value=None):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.deployment.release(value or request())
        self.assertNotIn("test-secret", output.getvalue())

    def test_success_records_exact_release_without_credentials(self):
        self.release()
        state = (self.deployment.state / "current.json").read_text()
        self.assertEqual(json.loads(state)["image"], IMAGE)
        self.assertNotIn("registry_password", state)

    def test_main_uses_same_watermark_as_develop(self):
        self.release(request(branch="main", pipeline_id=12))
        with self.assertRaisesRegex(RuntimeError, "Outdated"):
            self.release(request(pipeline_id=11))
        self.assertEqual(self.deployment.applied, [IMAGE])

    def test_same_pipeline_can_retry_same_release(self):
        self.release()
        self.release()
        self.assertEqual(len(self.deployment.applied), 2)

    def test_same_pipeline_cannot_change_digest(self):
        self.release()
        with self.assertRaisesRegex(RuntimeError, "identity"):
            self.release(request(image=REPOSITORY + "@sha256:" + "c" * 64))

    def test_health_failure_restores_previous_image_and_fails_job(self):
        self.deployment.fail_new_health = True
        with self.assertRaisesRegex(RuntimeError, "Deployment failed"):
            self.release()
        self.assertEqual(self.deployment.running, "sha256:old")
        result = json.loads((self.deployment.state / "last-result.json").read_text())
        self.assertEqual(result["rollback"], "restored")

    def test_incompatible_rollback_is_not_reported_as_success(self):
        self.deployment.fail_new_health = self.deployment.fail_rollback = True
        with self.assertRaises(RuntimeError):
            self.release()
        result = json.loads((self.deployment.state / "last-result.json").read_text())
        self.assertEqual(result["rollback"], "failed")

    def test_failed_newer_pipeline_still_blocks_older_deployment(self):
        self.deployment.fail_pull = True
        with self.assertRaises(RuntimeError):
            self.release(request(pipeline_id=20))
        self.deployment.fail_pull = False
        with self.assertRaisesRegex(RuntimeError, "Outdated"):
            self.release(request(pipeline_id=19))
        self.assertEqual(self.deployment.applied, [])

    def test_wrong_image_label_never_replaces_running_service(self):
        self.deployment.labels["org.opencontainers.image.revision"] = "c" * 40
        with self.assertRaisesRegex(RuntimeError, "label"):
            self.release()
        self.assertEqual(self.deployment.applied, [])

    def test_untrusted_release_inputs_are_rejected_before_commands(self):
        for overrides in (
            {"branch": "feature/x"},
            {"pipeline_id": True},
            {"revision": "latest"},
            {"image": REPOSITORY + ":latest"},
            {"image": "registry.example/other/backend@sha256:" + "a" * 64},
            {"registry_password": ""},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                self.release(request(**overrides))
        self.assertEqual(self.deployment.applied, [])


if __name__ == "__main__":
    unittest.main()
