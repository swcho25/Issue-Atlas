"""Exercise FE release/rollback without real credentials or a Docker daemon."""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("frontend_release", ROOT / "deploy/ci/deploy_backend.py")
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)
REPO = "test/frontend"
IMAGE = REPO + "@sha256:" + "a" * 64
SHA = "b" * 40
OLD_SHA = "c" * 40


class FakeFrontend(deploy.FrontendDeployment):
    def __init__(self, root):
        super().__init__({"app_dir": root, "image_repository": REPO, "project_url": "https://p",
                          "frontend_project": "test-dev-fe", "frontend_host_port": 3100,
                          "frontend_network": "dev-db", "frontend_url": "https://dev.example"})
        self.running = "sha256:old"
        self.calls = []
        self.fail_new = False

    def inspect(self, image):
        new = image == IMAGE
        return {"Id": "sha256:new" if new else "sha256:old", "Config": {"Labels": {
            "org.opencontainers.image.revision": SHA if new else OLD_SHA,
            "org.opencontainers.image.source": "https://p",
            "org.opencontainers.image.component": "frontend"}}}

    def current_image(self):
        return self.running

    def run(self, *args, **kwargs):
        self.calls.append((args, dict(self.env)))
        if "up" in args:
            self.running = "sha256:new" if self.env["FRONTEND_IMAGE"] == IMAGE else self.env["FRONTEND_IMAGE"]
        if "stop" in args:
            self.running = None
        return ""

    def healthy(self):
        if self.fail_new and self.running == "sha256:new":
            raise RuntimeError("failed new FE")


class FrontendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.fe = FakeFrontend(self.tmp.name)
        self.request = {"component": "frontend", "branch": "develop", "image": IMAGE,
                        "revision": SHA, "pipeline_id": 10, "registry_user": "test",
                        "registry_password": "never-log-this"}

    def release(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.fe.release(self.request)
        self.assertNotIn("never-log-this", out.getvalue())

    def test_release_only_replaces_frontend_and_has_separate_watermark(self):
        self.release()
        up, env = next((a, e) for a, e in self.fe.calls if "up" in a)
        self.assertEqual(up[-1], "frontend")
        self.assertIn("--no-deps", up)
        self.assertNotIn("--env-file", up)
        self.assertEqual(env["DEPLOYMENT_REVISION"], SHA)
        self.assertEqual(env["FRONTEND_NETWORK"], "dev-db")
        self.assertEqual(json.loads((self.fe.state / "current.json").read_text())["image"], IMAGE)
        self.assertFalse((Path(self.tmp.name) / ".deploy/current.json").exists())

    def test_failed_frontend_restores_old_image_and_old_revision(self):
        self.fe.fail_new = True
        with self.assertRaisesRegex(RuntimeError, "Deployment failed"):
            self.release()
        self.assertEqual(self.fe.running, "sha256:old")
        self.assertEqual(self.fe.env["DEPLOYMENT_REVISION"], OLD_SHA)
        self.assertEqual(json.loads((self.fe.state / "last-result.json").read_text())["rollback"], "restored")

    def test_first_release_failure_stops_candidate_without_false_rollback(self):
        self.fe.running = None
        self.fe.fail_new = True
        with self.assertRaisesRegex(RuntimeError, "Deployment failed"):
            self.release()
        self.assertIsNone(self.fe.running)
        result = json.loads((self.fe.state / "last-result.json").read_text())
        self.assertEqual(result["rollback"], "no_previous_release")

    def test_environment_ports_networks_and_projects_are_distinct(self):
        config = json.loads((ROOT / "deploy/ci/cicd.example.json").read_text())
        dev = config["environments"]["develop"]
        prod = config["environments"]["main"]
        for key in ("frontend_host_port", "frontend_network", "frontend_project", "frontend_url"):
            self.assertNotEqual(dev[key], prod[key])

    def test_factory_requires_explicit_environment_configuration(self):
        with self.assertRaisesRegex(ValueError, "not configured"):
            deploy.deployment_for({"app_dir": self.tmp.name}, "frontend")

    def test_public_health_revision_mismatch_is_rejected(self):
        self.fe.env["DEPLOYMENT_REVISION"] = SHA
        class Response(io.BytesIO):
            status = 200
            headers = {"Content-Type": "application/json", "Cache-Control": "no-store"}
        def response(req, **kwargs):
            return Response(json.dumps({"status": "UP", "revision": OLD_SHA}).encode())
        with patch.object(deploy.urllib.request, "urlopen", response), patch.object(deploy.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "revision"):
                deploy.FrontendDeployment.healthy(self.fe)


if __name__ == "__main__":
    unittest.main()
