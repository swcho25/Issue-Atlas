import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "ci/send_deploy.py"
SPEC = importlib.util.spec_from_file_location("send_deploy", MODULE)
send = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(send)


class SenderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.key, self.hosts = self.root / "key", self.root / "known_hosts"
        self.key.write_text("test-key")
        self.hosts.write_text("test-host-key")
        (self.root / "backend-image.txt").write_text(
            "swcho25/issueatlas-backend@sha256:" + "a" * 64
        )
        self.env = {
            "CI_PIPELINE_SOURCE": "push",
            "CI_COMMIT_BRANCH": "develop",
            "CI_COMMIT_REF_PROTECTED": "true",
            "DEPLOY_HOST": "ec2.example",
            "DEPLOY_USER": "ubuntu",
            "BACKEND_IMAGE_REPOSITORY": "swcho25/issueatlas-backend",
            "CI_COMMIT_SHA": "b" * 40,
            "CI_PIPELINE_ID": "10",
            "DOCKERHUB_USERNAME": "test-user",
            "DOCKERHUB_PULL_TOKEN": "test-secret",
            "SSH_PRIVATE_KEY": str(self.key),
            "SSH_KNOWN_HOSTS": str(self.hosts),
        }

    def invoke(self, execute):
        with (
            patch.dict(os.environ, self.env, clear=True),
            patch.object(send.subprocess, "run", execute),
        ):
            previous = Path.cwd()
            try:
                os.chdir(self.root)
                send.main()
            finally:
                os.chdir(previous)

    def test_registry_password_only_sent_on_stdin_and_temporary_key_removed(self):
        def execute(command, **kwargs):
            self.assertNotIn("test-secret", " ".join(command))
            self.assertEqual(json.loads(kwargs["input"])["branch"], "develop")
            self.assertIn("StrictHostKeyChecking=yes", command)
            self.assertEqual(command[-1], "ubuntu@ec2.example")
            self.temporary_key = Path(command[command.index("-i") + 1])
            self.assertEqual(self.temporary_key.read_text(), "test-key")

        self.invoke(execute)
        self.assertFalse(self.temporary_key.exists())

    def test_mr_never_contacts_deployment_host(self):
        self.env["CI_PIPELINE_SOURCE"] = "merge_request_event"
        with self.assertRaises(ValueError):
            self.invoke(lambda *args, **kwargs: self.fail("Unexpected SSH"))

    def test_unprotected_branch_never_contacts_deployment_host(self):
        self.env["CI_COMMIT_REF_PROTECTED"] = "false"
        with self.assertRaises(ValueError):
            self.invoke(lambda *args, **kwargs: self.fail("Unexpected SSH"))

    def test_foreign_image_artifact_is_rejected(self):
        (self.root / "backend-image.txt").write_text(
            "registry.example/other/image@sha256:" + "a" * 64
        )
        with self.assertRaises(ValueError):
            self.invoke(lambda *args, **kwargs: self.fail("Unexpected SSH"))

    def test_collector_uses_its_own_artifact_and_repository(self):
        self.env["DEPLOY_COMPONENT"] = "collector"
        self.env["COLLECTOR_IMAGE_REPOSITORY"] = "test/collector"
        (self.root / "collector-image.txt").write_text("test/collector@sha256:" + "c" * 64)

        def execute(command, **kwargs):
            payload = json.loads(kwargs["input"])
            self.assertEqual(payload["component"], "collector")
            self.assertEqual(payload["image"], "test/collector@sha256:" + "c" * 64)

        self.invoke(execute)

    def test_engine_uses_its_own_artifact_and_repository(self):
        self.env["DEPLOY_COMPONENT"] = "engine"
        self.env["ENGINE_IMAGE_REPOSITORY"] = "test/engine"
        (self.root / "engine-image.txt").write_text("test/engine@sha256:" + "e" * 64)

        def execute(command, **kwargs):
            payload = json.loads(kwargs["input"])
            self.assertEqual(payload["component"], "engine")
            self.assertEqual(payload["image"], "test/engine@sha256:" + "e" * 64)

        self.invoke(execute)

    def test_unknown_component_never_contacts_server(self):
        self.env["DEPLOY_COMPONENT"] = "database"
        with self.assertRaises(ValueError):
            self.invoke(lambda *args, **kwargs: self.fail("Unexpected SSH"))


if __name__ == "__main__":
    unittest.main()
