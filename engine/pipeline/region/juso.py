"""행안부 도로명주소 검색 API — 장소 이름 · 주소 → 주소 행(건물명 · 도로명주소 · 법정동 코드).

- API: https://business.juso.go.kr/addrlink/addrLinkApi.do (검색 API, 결과 저장 허용)
- 키: 루트 .env 의 JUSO_SEARCH_KEY. 없으면 from_env() 가 None — 장소 확인을 건너뛴다
- 좌표는 이 API 로 나오지 않는다(좌표는 SGIS, MR 2b-2)
p3-region-lab region_lab/juso.py 에서 옮겼다 (S15P31C108-203).
"""

import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import build_opener

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[3]
URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do"
PAUSE = 0.3  # 연속 호출 제한(E0007) 피하기
MAX_BYTES = 1_000_000
# 키 · 시스템 오류. 이 뒤로는 확인을 끈다. 다른 오류(E0006 너무 짧음 · E0011 결과 너무 많음 …)는
# 검색어 탓이라 결과 없음
FATAL = ("E0001", "-999")


class JusoError(Exception):
    """키 · 시스템 · 네트워크 오류. 문구에 키 · 주소를 넣지 않는다"""


class Juso:
    def __init__(self, key: str, get=None, sleep=time.sleep):
        self.key, self.sleep = key, sleep
        self.get = get or self._get

    @classmethod
    def from_env(cls, path: Path = ROOT / ".env") -> "Juso | None":
        key = dotenv_values(path, interpolate=False).get("JUSO_SEARCH_KEY")
        return cls(key) if key else None

    @staticmethod
    def _get(url: str) -> dict:
        try:
            with build_opener().open(url, timeout=20) as response:
                raw = response.read(MAX_BYTES + 1)
        except HTTPError as exc:
            raise JusoError(f"JUSO_HTTP_{exc.code}") from None
        except (URLError, TimeoutError, OSError):
            raise JusoError("JUSO_NETWORK_ERROR") from None
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeError, ValueError):
            raise JusoError("JUSO_INVALID_RESPONSE") from None

    def search(self, keyword: str) -> list[dict]:
        """검색 결과(최대 10건). 검색어 탓 오류면 [], 키 · 시스템 오류면 JusoError"""
        query = {"confmKey": self.key, "keyword": keyword, "currentPage": 1,
                 "countPerPage": 10, "resultType": "json"}  # fmt: skip
        body = self.get(f"{URL}?{urlencode(query)}")
        self.sleep(PAUSE)
        try:
            common, rows = body["results"]["common"], body["results"].get("juso") or []
        except (KeyError, TypeError):
            raise JusoError("JUSO_INVALID_RESPONSE") from None
        code = str(common.get("errorCode", ""))
        if code in FATAL:
            raise JusoError(f"JUSO_{code}")
        return rows if code == "0" else []


ROAD_NO = re.compile(r"([가-힣0-9]+(?:로|길))\s?(\d+)(?:-(\d+))?$")
JIBUN_NO = re.compile(r"([가-힣0-9]+[동리가])\s?(\d+)(?:-(\d+))?$")


def exact_matches(query: str, rows: list[dict]) -> list[dict]:
    """검색 API 는 '봉선로 1' 에 '봉선로 10' · '봉선로 100' 도 돌려준다 →
    도로명(또는 동 · 리) · 본번 · 부번이 정확히 같은 것만"""
    if m := ROAD_NO.search(query):
        keys = ("rn", "buldMnnm", "buldSlno")
    elif m := JIBUN_NO.search(query):
        keys = ("liNm" if m.group(1).endswith("리") else "emdNm", "lnbrMnnm", "lnbrSlno")
    else:
        return []
    want = (m.group(1), m.group(2), m.group(3) or "0")
    return [r for r in rows
            if (r.get(keys[0]), str(r.get(keys[1])), str(r.get(keys[2]) or 0)) == want]  # fmt: skip
