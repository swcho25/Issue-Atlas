"""GMS의 Gemini Embedding 2 호출. 키·본문·URL을 오류 로그에 넣지 않는다."""

import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import dotenv_values

from .model import DIMENSIONS, MODEL

ROOT = Path(__file__).resolve().parents[3]
URL = (
    "https://gms.ssafy.io/gmsapi/"
    "generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent"
)


def api_key() -> str:
    key = os.environ.get("GMS_API_KEY") or dotenv_values(ROOT / ".env", interpolate=False).get(
        "GMS_API_KEY"
    )
    if not key:
        raise RuntimeError("GMS_API_KEY가 설정되지 않았습니다")
    return key


def embed(text: str) -> list[float]:
    body = {
        "model": f"models/{MODEL}",
        "content": {"parts": [{"text": text}]},
        "embedContentConfig": {"outputDimensionality": DIMENSIONS},
    }
    request = Request(
        URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key()},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=90) as response:
                result = json.load(response)
            values = result["embedding"]["values"]
            if len(values) != DIMENSIONS:
                raise RuntimeError(f"GMS 임베딩 차원이 {len(values)}입니다. 예상: {DIMENSIONS}")
            return [float(value) for value in values]
        except HTTPError as error:
            if error.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2**attempt)
                continue
            raise RuntimeError(f"GMS 임베딩 HTTP {error.code}") from None
        except URLError:
            raise RuntimeError("GMS 임베딩 연결 실패") from None
    raise RuntimeError("GMS 임베딩 재시도 초과")
