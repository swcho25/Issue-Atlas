"""GMS 의 Gemini generateContent 호출. 키 · 본문 · 주소를 오류 문구에 넣지 않는다.

비용: 실행 한 건에 한 번 부른다. 429 · 5xx 만 두 번까지 다시 부르고, 검사 탈락은 다시 부르지 않는다.
"""

import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ai.classify.gms import api_key

MODEL = "gemini-2.5-flash"
URL = (
    "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
)
TIMEOUT = 30
MAX_OUTPUT_TOKENS = 4096


class LlmError(Exception):
    """모델 호출 실패 → LLM_ERROR"""


class LlmTimeout(LlmError):
    """시간 초과 → LLM_TIMEOUT"""


def generate(system: str, user: str, model: str = MODEL) -> str:
    """같은 입력이면 같은 답이 나오게 temperature 0. 답은 JSON 문자열"""
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
        },
    }
    try:
        key = api_key()
    except RuntimeError:
        raise LlmError("GMS_API_KEY가 설정되지 않았습니다") from None
    request = Request(
        URL.format(model),
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=TIMEOUT) as response:
                result = json.load(response)
            return "".join(p.get("text", "") for p in result["candidates"][0]["content"]["parts"])
        except HTTPError as error:
            if error.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(2**attempt)
                continue
            raise LlmError(f"GMS 문장화 HTTP {error.code}") from None
        except TimeoutError:
            raise LlmTimeout("GMS 문장화 시간 초과") from None
        except URLError as error:
            if isinstance(error.reason, TimeoutError):
                raise LlmTimeout("GMS 문장화 시간 초과") from None
            raise LlmError("GMS 문장화 연결 실패") from None
        except (KeyError, IndexError, TypeError, ValueError):
            raise LlmError("GMS 문장화 응답 형식 오류") from None
    raise LlmError("GMS 문장화 재시도 초과")
