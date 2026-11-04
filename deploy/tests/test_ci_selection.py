"""Validate the real YAML rules and dependency graph without running deployment jobs."""

import copy
import re
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]


class Reference(list):
    pass


class Loader(yaml.SafeLoader):
    pass


Loader.add_constructor("!reference", lambda loader, node: Reference(loader.construct_sequence(node)))


def configuration():
    config = yaml.load((ROOT / ".gitlab-ci.yml").read_text(encoding="utf-8"), Loader=Loader)
    for include in config["include"]:
        config.update(yaml.load((ROOT / include["local"]).read_text(encoding="utf-8"), Loader=Loader))

    def resolve(value):
        if isinstance(value, Reference):
            target = config
            for key in value:
                target = target[key]
            return resolve(target)
        if isinstance(value, list):
            result = []
            for item in value:
                resolved = resolve(item)
                result.extend(resolved if isinstance(item, Reference) and isinstance(resolved, list) else [resolved])
            return result
        if isinstance(value, dict):
            return {key: resolve(item) for key, item in value.items()}
        return value

    config = resolve(config)

    def job(name):
        value = copy.deepcopy(config[name])
        parents = value.pop("extends", [])
        parents = [parents] if isinstance(parents, str) else parents
        result = {}
        for parent in parents:
            result.update(job(parent))
        result.update(value)
        return result

    return {name: job(name) for name in config if name not in {"workflow", "stages", "default", "include", "variables"} and not name.startswith(".")}


def matches(path, pattern):
    # GitLab uses Ruby FNM_PATHNAME | FNM_DOTMATCH | FNM_EXTGLOB.
    # Support the glob subset used by this repository, including zero-directory **/.
    if "{" in pattern:
        before, rest = pattern.split("{", 1)
        choices, after = rest.split("}", 1)
        return any(matches(path, before + choice + after) for choice in choices.split(","))
    expression = ""
    i = 0
    while i < len(pattern):
        if pattern[i:i + 3] == "**/":
            expression += "(?:.*/)?"
            i += 3
        elif pattern[i:i + 2] == "**":
            expression += ".*"
            i += 2
        elif pattern[i] == "*":
            expression += "[^/]*"
            i += 1
        else:
            expression += re.escape(pattern[i])
            i += 1
    return re.fullmatch(expression, path) is not None


class SelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jobs = configuration()
        cls.root = yaml.load((ROOT / ".gitlab-ci.yml").read_text(encoding="utf-8"), Loader=Loader)

    def condition(self, expression, source, branch, protected, redeploy, target="develop"):
        values = {
            "CI_PIPELINE_SOURCE": source,
            "CI_COMMIT_BRANCH": branch,
            "CI_COMMIT_REF_PROTECTED": "true" if protected else "false",
            "REDEPLOY_COMPONENT": redeploy,
            "CI_MERGE_REQUEST_TARGET_BRANCH_NAME": target,
        }
        for part in expression.split(" && "):
            match = re.fullmatch(r'\$(\w+) (==|=~) (.+)', part)
            self.assertIsNotNone(match, f"Unsupported test expression: {part}")
            key, operator, expected = match.groups()
            actual = values[key]
            if operator == "==":
                result = actual == expected.strip('"')
            else:
                result = re.search(expected.strip("/"), actual) is not None
            if not result:
                return False
        return True

    def workflow(self, source="push", branch="develop", protected=True, redeploy="none", target="develop"):
        for rule in self.root["workflow"]["rules"]:
            if "if" in rule and not self.condition(rule["if"], source, branch, protected, redeploy, target):
                continue
            if rule.get("when") == "never":
                return None
            values = {k: v.get("value") if isinstance(v, dict) else v for k, v in self.root["variables"].items()}
            return values | rule.get("variables", {})
        return None

    def selected(self, paths, source="push", branch="develop", protected=True, redeploy="none"):
        if self.workflow(source, branch, protected, redeploy) is None:
            return set()
        selected = set()
        for name, job in self.jobs.items():
            if "rules" not in job:
                selected.add(name)
                continue
            for rule in job["rules"]:
                if "if" in rule:
                    if not self.condition(rule["if"], source, branch, protected, redeploy):
                        continue
                patterns = rule.get("changes")
                if patterns and not any(matches(path, pattern) for path in paths for pattern in patterns):
                    continue
                if rule.get("when") != "never":
                    selected.add(name)
                break
        return selected

    def test_component_scenarios_and_required_dependencies(self):
        fe = {"frontend", "frontend-worker", "frontend-deploy"}
        be = {"backend", "backend-image", "backend-deploy"}
        collector = {"engine", "collector-image", "collector-deploy"}
        baseline = {"harness", "infra"}
        scenarios = [
            (["frontend/src/pages/landing/ui/View.tsx"], fe),
            (["frontend/wrangler.json"], fe),
            (["deploy/frontend/verify.mjs"], fe),
            (["pnpm-lock.yaml"], fe),
            (["backend/src/main/java/App.java"], be),
            (["backend/src/main/resources/db/migration/V0007.sql"], be),
            (["engine/pipeline/collect/kosis.py"], collector),
            (["engine/uv.lock"], collector),
            # The collector image ships engine/ai for embed and score runs.
            (["engine/ai/classify/model.py"], collector),
            (["engine/ai/classify/thresholds.json"], collector),
            (["engine/ai/argument/README.md"], {"engine"}),
            (["engine/api/main.py"], {"engine"}),
            (["engine/tests/test_collect_kosis.py"], {"engine"}),
            (["frontend/src/a.ts", "backend/src/b.java"], fe | be),
            (["contracts/c1/schema.json"], {"frontend", "backend"} | collector),
            (["contracts/c2/openapi.yaml"], {"frontend", "backend", "engine"}),
            (["contracts/c2/examples/place-list.json"], {"frontend", "backend", "engine"}),
            (["contracts/c1/README.md", "contracts/c2/README.md"], set()),
            (["backend/src/main/java/App.java", "contracts/c2/README.md"], be),
            (["frontend/src/a.ts", "contracts/c2/README.md"], fe),
            (["engine/pipeline/collect/kosis.py", "contracts/c1/README.md"], collector),
            (["engine/pipeline/collect/README.md"], set()),
            (["contracts/c1/examples/raw/kosis-sp01-monthly.json"], {"frontend", "backend"} | collector),
            ([".gitlab/ci/changes.gitlab-ci.yml"], fe | be | collector),
            (["deploy/ci/send_deploy.py"], be | collector),
            (["deploy/frontend/README.md", "docs/plans/active/plan.md", "README.md"], set()),
            (["frontend/README.md", "backend/README.md", "engine/README.md"], set()),
        ]
        for branch in ("develop", "main"):
            for paths, expected in scenarios:
                with self.subTest(branch=branch, paths=paths):
                    selected = self.selected(paths, branch=branch)
                    self.assertEqual(selected, baseline | expected)
                    for name in selected:
                        for need in self.jobs[name].get("needs", []):
                            if not need.get("optional"):
                                self.assertIn(need["job"], selected)

    def test_mr_checks_without_deployment(self):
        selected = self.selected([".gitlab-ci.yml"], source="merge_request_event")
        self.assertEqual(selected, {"harness", "infra", "frontend", "backend", "engine", "frontend-worker"})
        self.assertEqual(self.selected(["docs/guide.md"], source="merge_request_event"), {"harness", "infra"})
        # Jobs without rules can default to except: merge_requests in GitLab.
        for name in ("harness", "infra"):
            self.assertEqual(self.jobs[name]["rules"], [{"when": "on_success"}])

    def test_manual_frontend_redeployment_runs_checks_and_bundle_only_for_selected_service(self):
        for branch, environment in (("develop", "development"), ("main", "production")):
            with self.subTest(branch=branch):
                for paths in ([], [".gitlab-ci.yml", "backend/src/App.java", "engine/pipeline/main.py"]):
                    selected = self.selected(paths, source="web", branch=branch, redeploy="frontend")
                    self.assertEqual(selected, {"harness", "infra", "frontend", "frontend-worker", "frontend-deploy"})
                    for name in selected:
                        for need in self.jobs[name].get("needs", []):
                            if not need.get("optional"):
                                self.assertIn(need["job"], selected)
                values = self.workflow(source="web", branch=branch, redeploy="frontend")
                self.assertEqual(values["WORKER_ENV"], environment)
                self.assertEqual(values["FRONTEND_URL"], "https://issue-atlas.kr" if branch == "main" else "https://dev.issue-atlas.kr")

    def test_manual_redeployment_rejects_other_sources_refs_and_unspecified_component(self):
        cases = [
            {"redeploy": "none"}, {"redeploy": "backend"},
            {"protected": False}, {"branch": "feature/test"}, {"branch": ""},
            {"source": "api"}, {"source": "schedule"},
        ]
        for overrides in cases:
            options = {"source": "web", "branch": "develop", "protected": True, "redeploy": "frontend"} | overrides
            with self.subTest(options=options):
                self.assertEqual(self.selected([".gitlab-ci.yml"], **options), set())

    def test_manual_selection_cannot_enable_deployment_in_an_mr(self):
        selected = self.selected(["frontend/src/a.ts"], source="merge_request_event", redeploy="frontend")
        self.assertEqual(selected, {"harness", "infra", "frontend", "frontend-worker"})

    def test_unprotected_push_cannot_deploy(self):
        selected = self.selected([".gitlab-ci.yml"], protected=False)
        self.assertFalse(any(name.endswith(("-deploy", "-image")) for name in selected))

    def test_optional_backend_still_waits_when_present(self):
        for name in ("collector-deploy", "frontend-deploy"):
            need = next(item for item in self.jobs[name]["needs"] if item["job"] == "backend-deploy")
            self.assertTrue(need["optional"])
            self.assertFalse(need["artifacts"])
        # Image jobs retain the check-stage barrier (no needs-based bypass).
        for name in ("backend-image", "collector-image", "frontend-worker"):
            self.assertNotIn("needs", self.jobs[name])

    def test_deleted_and_renamed_paths(self):
        # GitLab provides changed paths for deletions too; both sides of a move
        # must select their respective consumers, with no filesystem existence check.
        selected = self.selected(["backend/src/Old.java", "frontend/src/New.ts"])
        self.assertIn("backend-deploy", selected)
        self.assertIn("frontend-deploy", selected)

    def test_contract_only_mr_keeps_checks_without_worker_bundle(self):
        selected = self.selected(["contracts/c2/schemas/evidence.schema.json"], source="merge_request_event")
        self.assertEqual(selected, {"harness", "infra", "frontend", "backend", "engine"})
        # A moved runtime schema must still refresh the collector, even when deleted.
        selected = self.selected(["contracts/c1/record.schema.json", "contracts/p2/record.schema.json"])
        self.assertIn("collector-deploy", selected)
        self.assertNotIn("frontend-deploy", selected)
        self.assertNotIn("backend-deploy", selected)

    def test_environment_selection_and_worker_targets(self):
        config = yaml.load((ROOT / ".gitlab-ci.yml").read_text(encoding="utf-8"), Loader=Loader)
        self.assertEqual(config["variables"]["WORKER_ENV"], "development")
        for source, target in (("push", "main"), ("merge_request_event", "main")):
            rules = config["workflow"]["rules"]
            key = "CI_COMMIT_BRANCH" if source == "push" else "CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
            rule = next(r for r in rules if f'${key} == "{target}"' in r.get("if", "") and source in r["if"])
            self.assertEqual(rule["variables"]["WORKER_ENV"], "production")
        workers = __import__("json").loads((ROOT / "frontend/wrangler.json").read_text())
        for environment, domain in (("development", "dev.issue-atlas.kr"), ("production", "issue-atlas.kr")):
            worker = workers["env"][environment]
            self.assertEqual(worker["routes"][0]["pattern"], domain)
            self.assertEqual(worker["services"][0]["service"], worker["name"])
        for job in ("backend-deploy", "collector-deploy", "frontend-deploy"):
            self.assertEqual(self.jobs[job]["environment"]["name"], "${WORKER_ENV}-" + ("workers" if job == "frontend-deploy" else "ec2"))
            self.assertIn("$CI_COMMIT_BRANCH", self.jobs[job]["resource_group"])

    def test_browser_image_matches_installed_playwright_and_skips_downloads(self):
        package = __import__("json").loads((ROOT / "frontend/package.json").read_text())
        version = package["devDependencies"]["@playwright/test"]
        for name in ("frontend", "frontend-worker", "frontend-deploy"):
            job = self.jobs[name]
            self.assertRegex(job["image"], rf"playwright:v{re.escape(version)}-noble@sha256:[0-9a-f]{{64}}$")
            commands = job["before_script"] + job["script"]
            self.assertFalse(any("apt-get" in c or "playwright install" in c for c in commands))
            self.assertIn("pnpm install --frozen-lockfile", commands)
        node_cache = self.jobs["frontend"]["cache"][1]["key"]["prefix"]
        worker_cache = self.jobs["frontend-worker"]["cache"][1]["key"]["prefix"]
        self.assertNotEqual(node_cache, worker_cache)
        self.assertIn("$WORKER_ENV", worker_cache)

    def test_deployment_reuses_current_pipeline_bundle_without_rebuilding(self):
        job = self.jobs["frontend-deploy"]
        artifact = next(n for n in job["needs"] if n["job"] == "frontend-worker")
        self.assertTrue(artifact["artifacts"])
        self.assertIn("frontend/.open-next/", self.jobs["frontend-worker"]["artifacts"]["paths"])
        self.assertFalse(any("worker:build" in c or "next build" in c for c in job["script"]))
        self.assertEqual(job["cache"]["policy"], "pull")


if __name__ == "__main__":
    unittest.main()
