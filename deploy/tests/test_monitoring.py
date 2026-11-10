"""Guard isolation and dashboard queries in the actual monitoring configuration."""

import json
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1] / "monitoring"


class MonitoringConfigurationTest(unittest.TestCase):
    def test_no_public_ports_and_bounded_resources(self):
        config = yaml.safe_load((ROOT / "compose.yaml").read_text(encoding="utf-8"))
        for name, service in config["services"].items():
            self.assertRegex(service["image"], r"@sha256:[a-f0-9]{64}$", name)
            self.assertIn("mem_limit", service)
            self.assertIn("cpus", service)
            for port in service.get("ports", []):
                self.assertTrue(port.startswith("127.0.0.1:"), name)
        args = config["services"]["prometheus"]["command"]
        self.assertIn("--storage.tsdb.retention.time=7d", args)
        self.assertIn("--storage.tsdb.retention.size=2GB", args)
        self.assertNotIn("--web.enable-admin-api", args)
        grafana = config["services"]["grafana"]["environment"]
        self.assertEqual(grafana["GF_UNIFIED_ALERTING_ENABLED"], "false")
        self.assertEqual(grafana["GF_AUTH_ANONYMOUS_ENABLED"], "false")
        self.assertEqual(grafana["GF_SERVER_ROOT_URL"], "https://grafana.issue-atlas.kr/")
        self.assertEqual(grafana["GF_SECURITY_COOKIE_SECURE"], "true")
        self.assertEqual(grafana["GF_USERS_AUTO_ASSIGN_ORG_ROLE"], "Viewer")

    def test_public_proxy_only_routes_to_grafana(self):
        nginx = (ROOT / "nginx.conf").read_text(encoding="utf-8")
        self.assertIn("server_name grafana.issue-atlas.kr;", nginx)
        self.assertIn("return 301 https://grafana.issue-atlas.kr$request_uri;", nginx)
        self.assertIn("proxy_pass http://127.0.0.1:3002;", nginx)
        self.assertIn("ssl_protocols TLSv1.2 TLSv1.3;", nginx)
        self.assertIn("proxy_set_header Upgrade $http_upgrade;", nginx)
        self.assertNotIn("9090", nginx)
        self.assertNotIn("9091", nginx)

    def test_environment_and_dashboard_queries_are_not_alerts(self):
        prom = yaml.safe_load((ROOT / "prometheus.yml").read_text(encoding="utf-8"))
        self.assertNotIn("alerting", prom)
        self.assertNotIn("rule_files", prom)
        spring = next(job for job in prom["scrape_configs"] if job["job_name"] == "spring")
        self.assertEqual({item["labels"]["environment"] for item in spring["static_configs"]},
                         {"development", "production"})
        self.assertTrue(all(target.endswith(":9091") for item in spring["static_configs"]
                            for target in item["targets"]))
        dashboard = json.loads((ROOT / "grafana/dashboards/issueatlas.json").read_text(encoding="utf-8"))
        self.assertEqual(dashboard["templating"]["list"][0]["name"], "environment")
        for panel in dashboard["panels"]:
            self.assertNotIn("alert", panel)
            for target in panel.get("targets", []):
                if any(marker in target["expr"] for marker in ("job=\"spring\"", "job=\"containers\"", "job=\"health\"")):
                    self.assertIn('environment="$environment"', target["expr"])
