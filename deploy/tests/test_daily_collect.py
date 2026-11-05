import configparser
import datetime as dt
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

SCHEDULE = Path(__file__).resolve().parents[1] / "collector/schedule"
SPEC = importlib.util.spec_from_file_location("daily_collect", SCHEDULE / "daily_collect.py")
daily = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(daily)


class FakeRun:
    """실행기 대신 부른 인자를 모으고, 이름이 맞는 모드에 정한 종료 코드를 돌려준다."""

    def __init__(self, codes=None):
        self.codes = codes or {}
        self.calls = []

    def __call__(self, command, check):
        self.calls.append(command)
        return SimpleNamespace(returncode=self.codes.get(command[3], 0))


def units(name):
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    parser.optionxform = str
    parser.read(SCHEDULE / name, encoding="utf-8")
    return parser


class DailyCollectTests(unittest.TestCase):
    def test_steps_run_through_develop_runner_in_order(self):
        run = FakeRun()
        results = daily.run_all(dt.date(2026, 11, 5), run)
        self.assertEqual(results, {"press_yeosu": 0, "youth_policy": 0, "responses": 0})
        self.assertEqual(
            run.calls,
            [
                [daily.COLLECT, "--environment", "develop", "press", "--site", "yeosu", "--db",
                 "--start", "2026-10-22", "--end", "2026-11-05"],
                [daily.COLLECT, "--environment", "develop", "youth-policy"],
                [daily.COLLECT, "--environment", "develop", "responses"],
            ],
        )

    def test_failed_press_does_not_stop_youth_policy(self):
        run = FakeRun({"press": 1})
        results = daily.run_all(dt.date(2026, 11, 5), run)
        self.assertEqual(results, {"press_yeosu": 1, "youth_policy": 0, "responses": 0})
        self.assertEqual(len(run.calls), 3)

    def test_responses_wait_for_youth_policy(self):
        run = FakeRun({"youth-policy": 1})
        results = daily.run_all(dt.date(2026, 11, 5), run)
        self.assertEqual(results["responses"], "skipped")
        self.assertNotIn([daily.COLLECT, "--environment", "develop", "responses"], run.calls)

    def test_exit_code_is_nonzero_when_any_step_fails(self):
        at = dt.datetime(2026, 11, 4, 18, 0, tzinfo=dt.UTC)  # 11/5 03:00 KST
        self.assertEqual(daily.main(at, FakeRun()), 0)
        self.assertEqual(daily.main(at, FakeRun({"youth-policy": 2})), 1)

    def test_press_window_uses_korean_date(self):
        run = FakeRun()
        daily.main(dt.datetime(2026, 11, 4, 18, 0, tzinfo=dt.UTC), run)
        self.assertEqual(run.calls[0][-1], "2026-11-05")

    def test_timer_runs_daily_before_database_backup(self):
        timer = units("issueatlas-collect-daily.timer")
        self.assertEqual(timer["Timer"]["OnCalendar"], "*-*-* 03:00:00 Asia/Seoul")
        self.assertEqual(timer["Timer"]["Persistent"], "true")
        self.assertEqual(timer["Timer"]["Unit"], "issueatlas-collect-daily.service")
        backup = configparser.ConfigParser(interpolation=None, strict=False)
        backup.read(SCHEDULE.parents[1] / "backup/issueatlas-db-backup.timer", encoding="utf-8")
        backup_hour = int(backup["Timer"]["OnCalendar"].split()[1].split(":")[0])
        self.assertLess(3, backup_hour)

    def test_service_runs_installed_script_once(self):
        service = units("issueatlas-collect-daily.service")["Service"]
        self.assertEqual(service["Type"], "oneshot")
        self.assertEqual(service["ExecStart"], "/usr/bin/python3 /usr/local/sbin/issueatlas-collect-daily.py")
        self.assertEqual(ZoneInfo("Asia/Seoul"), daily.KST)


if __name__ == "__main__":
    unittest.main()
