"""모델 서버 연결 — OpenAI 호환 /chat/completions 하나로
자체 vLLM 서버와 외부 API 를 같은 코드로 부른다.

설정은 루트 .env 에서만 읽는다(.env.example 에 이름과 설명).
    P3_LLM_BASE_URL  예: http://<모델 서버>:8000/v1 (vLLM) · Qwen API 의 OpenAI 호환 주소
    P3_LLM_MODEL     예: Qwen/Qwen2.5-32B-Instruct-AWQ (프롬프트 p9.1 · s1 을 이 모델로 쟀다)
    P3_LLM_API_KEY   외부 API 키. 자체 서버면 비워 둔다
    P3_LLM_WORKERS   동시 요청 수(기본 4). vLLM AWQ 는 8 에서 엔진이 죽었다(2026-11-01)
주소 · 모델이 없으면 연결하지 않는다 — 모델 서버는 아직 없다(주피터 GPU 는 학습용, 2026-11-02).
"""

import json
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[3]
TIMEOUT = 180
MAX_BYTES = 1_000_000


class LlmError(Exception):
    """모델 서버 호출 실패. 문구에 주소 · 키 · 본문을 넣지 않는다"""


@dataclass(frozen=True)
class ModelServer:
    base_url: str
    model: str
    api_key: str = ""
    workers: int = 4

    @classmethod
    def from_env(cls, path: Path = ROOT / ".env") -> "ModelServer | None":
        config = dotenv_values(path, interpolate=False)
        base_url, model = config.get("P3_LLM_BASE_URL"), config.get("P3_LLM_MODEL")
        if not base_url or not model:
            return None
        workers = int(config.get("P3_LLM_WORKERS") or 4)
        return cls(base_url.rstrip("/"), model, config.get("P3_LLM_API_KEY") or "", workers)

    def __call__(self, system: str, user: str, max_tokens: int) -> str:
        """한 번 묻고 답 문자열. 같은 입력이면 같은 답이 나오게 temperature 0 · seed 0"""
        body = {
            "model": self.model,
            "temperature": 0,
            "seed": 0,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        request = Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with build_opener().open(request, timeout=TIMEOUT) as response:
                raw = response.read(MAX_BYTES + 1)
        except HTTPError as exc:
            raise LlmError(f"P3_LLM_HTTP_{exc.code}") from None
        except (URLError, TimeoutError, OSError):
            raise LlmError("P3_LLM_NETWORK_ERROR") from None
        try:
            return json.loads(raw.decode("utf-8"))["choices"][0]["message"]["content"] or ""
        except (UnicodeError, ValueError, KeyError, IndexError, TypeError):
            raise LlmError("P3_LLM_INVALID_RESPONSE") from None


def parse_json(raw: str) -> dict | None:
    """답에서 JSON 객체 하나. 앞뒤 말이 붙어도 첫 { 부터 마지막 } 까지"""
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        out = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
    return out if isinstance(out, dict) else None
