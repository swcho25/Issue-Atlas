"""region-extract: 가짜 모델 서버로 질문 · 재질문 · 확인 · 멈춤 · 이어 하기. 실제 모델 서버는 부르지 않는다."""

import io
import json

from pipeline.region import answer_region, answer_summary, extract, llm
from pipeline.region.load import event_row

BODY = "3월 1일 오후 여수국가산단의 한 화학공장에서 불이 나 작업자 두 명이 다쳤다. 소방당국은 원인을 조사하고 있다."
ARTICLE = {"id": "n1", "title": "여수산단 화학공장서 불", "lead": BODY,
           "published_at": "2025-03-02T00:00:00.000+09:00", "source": "가상일보"}  # fmt: skip
REGION = {"mentions": ["여수"], "sido": "전남광주통합특별시", "sigun": "여수시", "gu": "", "emd": "",
          "places": ["여수국가산단", "여수시"], "orgs": []}  # fmt: skip
SUMMARY = {"summary": "여수국가산단 화학공장에서 불이 나 작업자 2명이 다쳤다.",
           "event": {"start": "2025-03-01", "end": "", "basis": "3월 1일"}}  # fmt: skip


class Server:
    """질문 종류(system) · 덧붙임으로 답을 고른다. 받은 질문을 남긴다"""

    def __init__(self, region=None, summary=None, model="fake", workers=2):
        self.region, self.summary = region or {}, summary or {}
        self.model, self.workers, self.asked = model, workers, []

    def __call__(self, system, user, max_tokens):
        kind = "region" if system is answer_region.SYSTEM else "summary"
        hint = next((h for h in (answer_region.LIMIT_HINT, answer_summary.REWRITE_HINT,
                                 answer_summary.JSON_HINT) if user.endswith(h)), "")  # fmt: skip
        self.asked.append((kind, hint))
        answers = self.region if kind == "region" else self.summary
        answer = answers.get(hint, answers.get(""))
        if isinstance(answer, Exception):
            raise answer
        return answer if isinstance(answer, str) else json.dumps(answer, ensure_ascii=False)


def run(articles, server):
    out = io.StringIO()
    stats = extract.extract(articles, server, out, server.workers, server.model)
    return stats, [json.loads(line) for line in out.getvalue().splitlines()]


def test_row_is_region_load_input():
    stats, [row] = run([ARTICLE], Server({"": REGION}, {"": SUMMARY}))
    assert stats == {"written": 1, "held": 0}
    assert (row["sigungu"], row["mentions"], row["places"]) == (
        "여수시",
        ["여수"],
        ["여수국가산단"],
    )
    assert row["notes"]["장소아님_뺌"] == ["여수시"]  # 행정 이름은 장소가 아니다
    assert (row["event_start"], row["event_end"], row["time_precision"]) == (
        "2025-03-01T00:00:00+09:00", "2025-03-02T00:00:00+09:00", "day")  # fmt: skip
    assert (row["prompt_version"], row["summary_version"]) == (
        "p9.1",
        answer_summary.SUMMARY_VERSION,
    )
    assert (row["summary"], row["model"]) == (SUMMARY["summary"], "fake")
    assert "lead" not in row and BODY not in json.dumps(row, ensure_ascii=False)
    loaded, reason = event_row(row, ARTICLE["title"], BODY, ARTICLE["published_at"])
    assert reason is None and loaded["sigun"] == "여수시"


def test_cut_json_is_asked_again_with_limits_then_held():
    cut = '{"mentions": ["광주", "광주", "광주'
    server = Server({"": cut, answer_region.LIMIT_HINT: REGION}, {"": SUMMARY})
    assert run([ARTICLE], server)[1][0]["sigungu"] == "여수시"
    assert ("region", answer_region.LIMIT_HINT) in server.asked

    _, [row] = run([ARTICLE], Server({"": cut}, {"": SUMMARY}))
    assert (row["sigungu"], row["notes"]["오류"]) == ("보류", "JSON 아님")


def test_guessed_gwangju_gu_becomes_gwangju_with_note():
    guess = REGION | {"mentions": ["광주"], "sigun": "광주", "gu": "북구", "places": []}
    article = ARTICLE | {"title": "광주 한 공장서 불", "lead": "광주의 한 공장에서 불이 났다. " * 3}
    _, [row] = run([article], Server({"": guess}, {"": SUMMARY}))
    assert (row["sigungu"], row["notes"]["구추측"]) == ("광주권", "광주 북구")


def test_copied_summary_is_rewritten_once():
    copied = SUMMARY | {"summary": BODY[:70]}
    server = Server({"": REGION}, {"": copied, answer_summary.REWRITE_HINT: SUMMARY})
    _, [row] = run([ARTICLE], server)
    assert row["summary"] == SUMMARY["summary"] and row["notes"]["요약_다시씀"] is True

    _, [row] = run([ARTICLE], Server({"": REGION}, {"": copied}))
    assert row["summary"] == BODY[:70] and row["notes"]["요약_본문옮김"] is True


def test_no_date_falls_back_to_published():
    _, [row] = run([ARTICLE], Server({"": REGION}, {"": SUMMARY | {"event": {}}}))
    assert (row["event_start"], row["time_precision"]) == ("2025-03-02T00:00:00+09:00", "published")


def test_broken_batch_is_not_written():
    down = llm.LlmError("P3_LLM_NETWORK_ERROR")
    stats, rows = run([ARTICLE, ARTICLE | {"id": "n2"}], Server({"": down}, {"": down}))
    assert stats == {"written": 0, "held": 0, "stopped_at": 0} and rows == []


def test_main_needs_model_server_and_skips_done(tmp_path, capsys):
    articles = tmp_path / "articles.jsonl"
    articles.write_text("".join(json.dumps(ARTICLE | {"id": i}, ensure_ascii=False) + "\n"
                                for i in ("a", "b")), encoding="utf-8")  # fmt: skip
    out, done = tmp_path / "extract.jsonl", tmp_path / "done.jsonl"
    args = ["--input", str(articles), "--output", str(out)]
    assert extract.main(args, server=lambda: None) == 1
    assert "P3_LLM_NOT_CONFIGURED" in capsys.readouterr().err and not out.exists()

    done.write_text(json.dumps({"id": "a"}) + "\n", encoding="utf-8")
    server = Server({"": REGION}, {"": SUMMARY})
    assert extract.main([*args, "--done", str(done)], server=lambda: server) == 0
    assert json.loads(capsys.readouterr().out) == {
        "input": 2, "skipped_done": 1, "written": 1, "held": 0}  # fmt: skip
    assert [json.loads(line)["id"] for line in out.read_text(encoding="utf-8").splitlines()] == [
        "b"
    ]


def test_model_server_from_env_and_request(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("P3_LLM_BASE_URL=\nP3_LLM_MODEL=\n", encoding="utf-8")
    assert llm.ModelServer.from_env(env) is None
    env.write_text("P3_LLM_BASE_URL=http://model.test/v1/\nP3_LLM_MODEL=qwen\n", encoding="utf-8")
    server = llm.ModelServer.from_env(env)
    assert (server.base_url, server.api_key, server.workers) == ("http://model.test/v1", "", 4)

    sent = []

    class Opener:
        def open(self, request, timeout):
            sent.append(request)
            return io.BytesIO(json.dumps({"choices": [{"message": {"content": "{}"}}]}).encode())

    monkeypatch.setattr(llm, "build_opener", Opener)
    assert server("시스템", "질문", 500) == "{}"
    body = json.loads(sent[0].data)
    assert sent[0].full_url == "http://model.test/v1/chat/completions"
    assert (body["model"], body["temperature"], body["max_tokens"]) == ("qwen", 0, 500)
    assert "Authorization" not in sent[0].headers  # 자체 서버는 키 없이
