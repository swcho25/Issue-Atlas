"""부하 시험용 가짜 engine.

POST /v1/argument/phrase 에 DELAY_SECONDS 만큼 기다렸다가 done 을 준다.

실제 LLM 문장화의 지연(실측 평균 13초)만 흉내 낸다.
보증 문장은 받은 카드 문구 그대로, 반박은 비운다.
GET /stats 는 지금까지 받은 문장화 요청 수와 동시에 처리 중인 수를 준다.

    python backend/loadtest/fake_engine.py            # 127.0.0.1:18000, 13초
    PORT=18000 DELAY_SECONDS=13 python backend/loadtest/fake_engine.py
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DELAY = float(os.environ.get("DELAY_SECONDS", "13"))
PORT = int(os.environ.get("PORT", "18000"))
HOST = os.environ.get("HOST", "127.0.0.1")  # backend 를 컨테이너로 띄우면 0.0.0.0

lock = threading.Lock()
stats = {"calls": 0, "in_flight": 0, "max_in_flight": 0}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path != "/stats":
            self.send_error(404)
            return
        with lock:
            self.reply(200, dict(stats))

    def do_POST(self):
        if self.path != "/v1/argument/phrase":
            self.send_error(404)
            return
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        with lock:
            stats["calls"] += 1
            stats["in_flight"] += 1
            stats["max_in_flight"] = max(stats["max_in_flight"], stats["in_flight"])
        try:
            time.sleep(DELAY)
            judgment = body.get("judgment", {})
            warrant = judgment.get("warrant") or {}
            self.reply(
                200,
                {
                    "schema_version": "ai-phrasing-result-0.2",
                    "run_id": judgment.get("run_id"),
                    "status": "done",
                    "reason_code": None,
                    "retryable": False,
                    "warrant": {"text": warrant.get("text") or "", "provenance": "llm"},
                    "rebuttals": [],
                    "citations": {},
                    "problems": [],
                    "model": "fake-engine",
                    "prompt_version": "fake",
                },
            )
        finally:
            with lock:
                stats["in_flight"] -= 1

    def reply(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print(f"fake engine {HOST}:{PORT} delay {DELAY}s", flush=True)
    server.serve_forever()
