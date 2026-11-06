"""Protect public proxy isolation, IP trust and credential destination selection."""
import importlib.util
import json
from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]


class BackendProxyTests(unittest.TestCase):
    def test_both_deployments_use_https_without_tunnel(self):
        example = json.loads((ROOT / "deploy/ci/cicd.example.json").read_text(encoding="utf-8"))
        for branch in ("develop", "main"):
            files = example["environments"][branch]["compose_files"]
            self.assertEqual(files, ["compose.yaml", "compose.https.yaml", "compose.release.yaml"])
        https = yaml.safe_load((ROOT / "deploy/dev/compose.https.yaml").read_text(encoding="utf-8"))
        self.assertEqual(set(https["services"]), {"backend"})
        self.assertEqual(https["services"]["backend"]["environment"]["SESSION_COOKIE_SECURE"], "true")

    def test_proxy_keeps_paths_and_replaces_untrusted_ip_headers(self):
        proxy = (ROOT / "deploy/backend/nginx.conf.template").read_text(encoding="utf-8")
        self.assertIn("proxy_pass http://127.0.0.1:BACKEND_PORT;", proxy)
        self.assertIn('proxy_set_header Forwarded "";', proxy)
        self.assertIn("proxy_set_header X-Forwarded-For $remote_addr;", proxy)
        self.assertIn("proxy_set_header CF-Connecting-IP $remote_addr;", proxy)
        self.assertIn("location = /actuator/prometheus { return 404; }", proxy)
        self.assertIn("ssl_protocols TLSv1.2 TLSv1.3;", proxy)
        frontend = (ROOT / "deploy/frontend/nginx.conf.template").read_text(encoding="utf-8")
        self.assertEqual(frontend.count("proxy_set_header CF-Connecting-IP $remote_addr;"), 2)

    def test_session_check_uses_the_matching_backend_and_no_other_origin(self):
        spec = importlib.util.spec_from_file_location("verify_proxy", ROOT / "deploy/dev/verify.py")
        verify = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verify)
        self.assertEqual(verify.SESSION_AUTH_ORIGINS, {
            "https://dev-backend.issue-atlas.kr": "issueatlas-dev-backend-1",
            "https://backend.issue-atlas.kr": "issueatlas-prod-backend-1",
        })
