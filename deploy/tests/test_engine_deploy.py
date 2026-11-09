"""engine(논증 문장화 API) 배포 — 배포 프로그램 · compose · Dockerfile 을 Docker 없이 검사한다 (S15P31C108-243)."""

import contextlib
import importlib.util
import io
import json
import re
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("engine_release", ROOT / "deploy/ci/deploy_backend.py")
deploy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy)
REPO = "registry.example/team/engine"
IMAGE = REPO + "@sha256:" + "a" * 64
BACKEND = "registry.example/team/backend@sha256:" + "d" * 64


class FakeEngine(deploy.EngineDeployment):
    """Runs the real apply/healthy/release logic; only Docker itself is simulated."""

    def __init__(self, root):
        super().__init__({"app_dir": root, "image_repository": REPO, "project_url": "https://p"})
        self.commands = []
        self.running = "sha256:old"
        self.component = "engine"
        self.fail_new_health = False

    def run(self, *args, **kwargs):
        self.commands.append((args, dict(self.env)))
        if args[:2] == ("docker", "inspect"):
            return "unhealthy" if self.running == "sha256:new" and self.fail_new_health else "healthy"
        if "ps" in args:
            return "engine-container" if self.running else ""
        if "up" in args:
            image = self.env["ENGINE_IMAGE"]
            self.running = "sha256:new" if image == IMAGE else image
        if "stop" in args:
            self.running = None
        return ""

    def current_image(self):
        return self.running

    def inspect(self, image):
        labels = {
            "org.opencontainers.image.revision": "b" * 40,
            "org.opencontainers.image.source": "https://p",
            "org.opencontainers.image.component": self.component,
        }
        return {"Id": "sha256:new", "Config": {"Labels": labels}}

    def compose_commands(self, verb):
        return [(c, env) for c, env in self.commands if c[:2] == ("docker", "compose") and verb in c]


class EngineReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".deploy").mkdir()
        deploy.write_json(self.root / ".deploy/current.json", {"image": BACKEND})
        self.engine = FakeEngine(self.temp.name)
        self.request = {
            "component": "engine",
            "branch": "develop",
            "pipeline_id": 10,
            "revision": "b" * 40,
            "image": IMAGE,
            "registry_user": "test",
            "registry_password": "not-a-real-token",
        }

    def release(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.engine.release(self.request)
        self.assertNotIn("not-a-real-token", output.getvalue())

    def test_release_replaces_only_engine_by_digest_and_keeps_backend_record(self):
        self.release()
        (up, env), = self.engine.compose_commands("up")
        self.assertEqual(up[-1], "engine")
        for flag in ("--no-deps", "--no-build", "--wait"):
            self.assertIn(flag, up)
        self.assertEqual(up[up.index("--pull") + 1], "never")
        # compose.release.yaml needs both digests; the backend one comes from its own record.
        self.assertEqual((env["ENGINE_IMAGE"], env["BACKEND_IMAGE"]), (IMAGE, BACKEND))
        record = json.loads((self.root / ".deploy/engine/current.json").read_text())
        self.assertEqual(record["image"], IMAGE)
        self.assertNotIn("registry_password", json.dumps(record))
        self.assertEqual(json.loads((self.root / ".deploy/current.json").read_text())["image"], BACKEND)

    def test_unhealthy_engine_restores_previous_image(self):
        self.engine.fail_new_health = True
        with self.assertRaisesRegex(RuntimeError, "Deployment failed"):
            self.release()
        self.assertEqual(self.engine.running, "sha256:old")
        result = json.loads((self.root / ".deploy/engine/last-result.json").read_text())
        self.assertEqual(result["rollback"], "restored")
        self.assertFalse((self.root / ".deploy/engine/current.json").exists())

    def test_first_engine_failure_stops_candidate(self):
        self.engine.running = None
        self.engine.fail_new_health = True
        with self.assertRaises(RuntimeError):
            self.release()
        self.assertIsNone(self.engine.running)
        (stop, _), = self.engine.compose_commands("stop")
        self.assertEqual(stop[-1], "engine")
        result = json.loads((self.root / ".deploy/engine/last-result.json").read_text())
        self.assertEqual(result["rollback"], "no_previous_release")

    def test_backend_image_cannot_be_published_as_engine(self):
        self.engine.component = "backend"
        with self.assertRaisesRegex(RuntimeError, "component"):
            self.release()
        self.assertEqual(self.engine.compose_commands("up"), [])

    def test_engine_watermark_is_separate_from_backend(self):
        deploy.write_json(self.root / ".deploy/watermark.json", {"pipeline_id": 99})
        self.release()
        self.assertEqual(json.loads((self.root / ".deploy/watermark.json").read_text())["pipeline_id"], 99)
        self.request["pipeline_id"] = 9
        with self.assertRaisesRegex(RuntimeError, "Outdated"):
            self.release()

    def test_backend_deployment_passes_compose_before_and_after_first_engine_release(self):
        config = {"app_dir": self.temp.name, "image_repository": "r", "project_url": "p"}
        self.assertEqual(deploy.Deployment(config).env["ENGINE_IMAGE"], deploy.ENGINE_NOT_DEPLOYED)
        self.release()
        self.assertEqual(deploy.Deployment(config).env["ENGINE_IMAGE"], IMAGE)

    def test_engine_runs_only_in_configured_environments(self):
        config = json.loads((ROOT / "deploy/ci/cicd.example.json").read_text())
        develop = {**deploy.environment_config(config, "develop"), "app_dir": self.temp.name}
        self.assertIsInstance(deploy.deployment_for(develop, "engine"), deploy.EngineDeployment)
        main = {**deploy.environment_config(config, "main"), "app_dir": self.temp.name}
        self.assertIsInstance(deploy.deployment_for(main, "engine"), deploy.EngineDeployment)
        main.pop("engine_image_repository")
        with self.assertRaisesRegex(ValueError, "not configured"):
            deploy.deployment_for(main, "engine")
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            deploy.deployment_for(develop, "database")


def load(name):
    return yaml.safe_load((ROOT / "deploy/dev" / name).read_text(encoding="utf-8"))


class EngineComposeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compose = load("compose.yaml")
        cls.engine = cls.compose["services"]["engine"]

    def test_engine_is_private_and_least_privileged(self):
        engine = self.engine
        self.assertNotIn("ports", engine)
        # Only backend shares this network; the DB network (default) is not reachable.
        self.assertEqual(engine["networks"], ["engine"])
        self.assertEqual(engine["user"], "10001:10001")
        self.assertIs(engine["read_only"], True)
        self.assertEqual(engine["cap_drop"], ["ALL"])
        self.assertIn("no-new-privileges:true", engine["security_opt"])
        for limit in ("mem_limit", "cpus", "pids_limit"):
            self.assertIn(limit, engine)
        self.assertEqual(engine["build"]["target"], "api")
        self.assertIn("/health", " ".join(engine["healthcheck"]["test"]))

    def test_key_comes_only_from_read_only_env_file(self):
        (volume,) = self.engine["volumes"]
        self.assertEqual((volume["type"], volume["target"]), ("bind", "/app/.env"))
        self.assertIs(volume["read_only"], True)
        self.assertIs(volume["bind"]["create_host_path"], False)
        self.assertTrue(volume["source"].startswith("${ENGINE_ENV_FILE"))
        self.assertNotIn("env_file", self.engine)
        self.assertFalse([k for k in self.engine.get("environment", {}) if "KEY" in k or "GMS" in k])
        example = (ROOT / "deploy/dev/.env.example").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"^GMS_API_KEY\s*=", example, re.M))
        self.assertIn("ENGINE_ENV_FILE=", example)

    def test_production_key_mount_is_fixed_and_overrides_development_target(self):
        config = json.loads((ROOT / "deploy/ci/cicd.example.json").read_text())
        development = config["environments"]["develop"]
        production = config["environments"]["main"]
        override = "compose.production-engine.yaml"
        self.assertNotIn(override, development["compose_files"])
        self.assertIn(override, production["compose_files"])
        (volume,) = load(override)["services"]["engine"]["volumes"]
        self.assertEqual(volume["source"], "/etc/issueatlas/production/engine.env")
        self.assertEqual(volume["target"], self.engine["volumes"][0]["target"])
        self.assertIs(volume["read_only"], True)
        self.assertIs(volume["bind"]["create_host_path"], False)
        self.assertNotEqual(development["app_dir"], production["app_dir"])

    def test_backend_calls_engine_only_when_env_sets_url(self):
        backend = self.compose["services"]["backend"]
        self.assertIn("engine", backend["networks"])
        self.assertEqual(backend["environment"]["ENGINE_URL"], "${ENGINE_URL:-}")
        self.assertNotIn("engine", backend.get("depends_on", {}))
        example = (ROOT / "deploy/dev/.env.example").read_text(encoding="utf-8").splitlines()
        self.assertIn("ENGINE_URL=", example)

    def test_release_pins_engine_digest_and_public_proxy_never_reaches_engine(self):
        release = load("compose.release.yaml")["services"]
        self.assertTrue(release["engine"]["image"].startswith("${ENGINE_IMAGE:?"))
        proxy = (ROOT / "deploy/backend/nginx.conf.template").read_text(encoding="utf-8")
        self.assertNotIn("engine:8000", proxy)
        self.assertEqual(proxy.count("proxy_pass "), 1)
        self.assertIn("proxy_pass http://127.0.0.1:BACKEND_PORT;", proxy)

    def test_every_service_network_keeps_egress_on_shared_ci_host(self):
        script = (ROOT / "deploy/ci/runner/restore-service-egress.sh").read_text(encoding="utf-8")
        listed = set(re.search(r"^for network in (.+); do$", script, re.M).group(1).split())
        for project in ("issueatlas-dev", "issueatlas-prod"):
            for network in ["default", *self.compose.get("networks", {})]:
                self.assertIn(f"{project}_{network}", listed)


class EngineImageTests(unittest.TestCase):
    def test_collector_stays_default_target_and_api_skips_pipeline(self):
        dockerfile = (ROOT / "engine/Dockerfile").read_text(encoding="utf-8")
        stages = dict(re.findall(r"^FROM \S+ AS (\w+)\n(.*?)(?=^FROM |\Z)", dockerfile, re.M | re.S))
        self.assertEqual(list(stages)[-1], "collector")
        self.assertIn('"pipeline.collect"', stages["collector"])
        self.assertIn('"api.main:app"', stages["api"])
        self.assertNotIn("engine/pipeline", stages["base"] + stages["api"])
        ignore = (ROOT / "engine/Dockerfile.dockerignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("!engine/api/**", ignore)
        self.assertIn("**/.env*", ignore)


if __name__ == "__main__":
    unittest.main()
