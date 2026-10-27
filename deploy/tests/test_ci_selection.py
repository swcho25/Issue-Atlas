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

    return {name: job(name) for name in config if name not in {"workflow", "stages", "default", "include"} and not name.startswith(".")}


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

    def selected(self, paths, source="push", branch="develop", protected=True):
        selected = set()
        for name, job in self.jobs.items():
            if "rules" not in job:
                selected.add(name)
                continue
            for rule in job["rules"]:
                if "if" in rule:
                    self.assertEqual(rule["if"], '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH =~ /^(develop|main)$/ && $CI_COMMIT_REF_PROTECTED == "true"')
                    if not (source == "push" and branch in {"develop", "main"} and protected):
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
            (["engine/api/main.py"], {"engine"}),
            (["engine/tests/test_collect_kosis.py"], {"engine"}),
            (["frontend/src/a.ts", "backend/src/b.java"], fe | be),
            (["contracts/c1/schema.json"], fe | be | collector),
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


if __name__ == "__main__":
    unittest.main()
