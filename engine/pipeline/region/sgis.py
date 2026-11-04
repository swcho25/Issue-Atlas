"""통계청 SGIS 지오코딩 — 주소 → WGS84 좌표 · 법정동 코드 · 행정동 코드.

- 인증: /auth/authentication.json (consumer_key · consumer_secret → accessToken)
- 지오코딩: /addr/geocodewgs84.json (WGS84, EPSG:4326).
  결과 저장 금지 문구 없음, 출처(통계청 SGIS) 표시
- 경계: /boundary/hadmarea.geojson (UTM-K, EPSG:5179) — pipeline.region.boundary 가 쓴다
- 키: 루트 .env 의 SGIS_KEY · SGIS_SECRET. 없으면 from_env() 가 None — 위치를 정하지 않는다
p3-region-lab region_lab/sgis.py 에서 옮겼다 (S15P31C108-206).
"""

import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import build_opener

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[3]
BASE = "https://sgisapi.mods.go.kr/OpenAPI3"
PAUSE = 0.2
MAX_BYTES = 1_000_000
BUILDING = "6"  # addr_type 6 = 건물 단위로 찍힌 좌표. 1 ~ 5 는 시도 ~ 읍면동 중심
OLD_SIDO = re.compile(r"^(전라남도|광주광역시|전남광주통합특별시|전남|광주)\s+")
GJ_GU_PREFIX = re.compile(r"^(광주광역시|광주|전남광주통합특별시)\s+(동구|서구|남구|북구|광산구)\s")


class SgisError(Exception):
    """키 · 시스템 · 네트워크 오류. 문구에 키 · 주소를 넣지 않는다"""


@dataclass(frozen=True)
class Point:
    lon: float
    lat: float
    addr_type: str  # 6 건물 · 1 ~ 5 행정 구역 중심
    leg_cd: str  # 법정동 코드(8 · 10자리)
    adm_cd: str  # 행정동 코드(SGIS 8자리) — place_code_map(sgis)


def address_candidates(raw: str) -> list[str]:
    """검색어 후보. 앞에서부터 찾아 처음 찾은 것을 쓴다(정리를 점점 세게).
    '전남광주통합특별시 여수시 서교1길 28-1 서강동주민자치센터 (서교동)'
      → '여수시 서교1길 28-1 서강동주민자치센터' → '여수시 서교1길 28-1' → '여수시 서교1길'"""
    s = re.sub(r"\([^)]*\)", " ", raw)  # 괄호(법정동 참고항목 · 설명)
    s = re.sub(r"[%=><\[\]\"';]", " ", s)  # 검색 API 가 거절하는 특수문자
    s = re.sub(r"\s+", " ", s).strip()
    # 광주 구(동구 · 서구 …)는 다른 광역시에도 있어 시도를 떼면 헷갈린다 → '광주광역시 서구 …'
    gwangju_gu = GJ_GU_PREFIX.match(s)
    s = OLD_SIDO.sub("", s)  # 시도명은 통합 전후로 달라서 뺀다
    if gwangju_gu:
        s = f"광주광역시 {s}"
    out = [s]
    if m := re.match(r"(.*?(?:로|길)(?:\d+번길)?\s?\d+(?:-\d+)?)(?:\s|$)", s):
        out += [m.group(1), re.sub(r"\s?\d+(?:-\d+)?$", "", m.group(1))]  # 건물번호까지 · 도로명만
    elif m := re.match(r"(.*?[동리가]\s?\d+(?:-\d+)?)(?:\s|$)", s):
        out += [m.group(1), re.sub(r"-\d+$", "", m.group(1))]  # 번지까지 · 본번만
    return [c for i, c in enumerate(out) if c and len(c) >= 2 and c not in out[:i]]


class Sgis:
    def __init__(self, key: str, secret: str, get=None, sleep=time.sleep, now=time.time):
        self.key, self.secret, self.sleep, self.now = key, secret, sleep, now
        self.get = get or self._get_url
        self.token, self.expires = "", 0.0

    @classmethod
    def from_env(cls, path: Path = ROOT / ".env") -> "Sgis | None":
        config = dotenv_values(path, interpolate=False)
        key, secret = config.get("SGIS_KEY"), config.get("SGIS_SECRET")
        return cls(key, secret) if key and secret else None

    @staticmethod
    def _get_url(url: str) -> dict:
        try:
            with build_opener().open(url, timeout=20) as response:
                raw = response.read(MAX_BYTES + 1)
        except HTTPError as exc:
            raise SgisError(f"SGIS_HTTP_{exc.code}") from None
        except (URLError, TimeoutError, OSError):
            raise SgisError("SGIS_NETWORK_ERROR") from None
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeError, ValueError):
            raise SgisError("SGIS_INVALID_RESPONSE") from None

    def _call(self, path: str, retry: bool = True, field: str = "result", **params):
        """결과 칸(기본 result, 경계는 features). 결과 없음(-100)이면 {},
        이 검색어를 처리하지 못함(-1, 옛 지명)이면 None"""
        body = self.get(f"{BASE}{path}?{urlencode(params)}")
        self.sleep(PAUSE)
        code = str(body.get("errCd"))
        if code == "-401" and "accessToken" in params and retry:  # 토큰 만료 → 다시 받아 한 번
            self.token = ""
            return self._call(path, False, field, **{**params, "accessToken": self._token()})
        if code == "-1":
            return None
        if code not in ("0", "-100"):
            raise SgisError(f"SGIS_{code}")
        return body.get(field) or {}

    def _token(self) -> str:
        if self.token and self.now() < self.expires - 60:
            return self.token
        result = self._call("/auth/authentication.json", consumer_key=self.key,
                            consumer_secret=self.secret) or {}  # fmt: skip
        self.token = result.get("accessToken") or ""
        if not self.token:
            raise SgisError("SGIS_NO_TOKEN")
        t = float(result.get("accessTimeout") or 0)
        # 문서는 초, 실제는 밀리초로 오기도 한다
        self.expires = t / 1000 if t > 1e12 else (t or self.now() + 3000)
        return self.token

    def search(self, address: str) -> list[Point]:
        """주소 하나 → 결과(최대 5). 못 찾거나 처리하지 못한 검색어는 []"""
        result = self._call("/addr/geocodewgs84.json", accessToken=self._token(),
                            address=address, resultcount=5)  # fmt: skip
        rows = (result or {}).get("resultdata") or []
        out = []
        for r in rows:
            try:
                xy = float(r["x"]), float(r["y"])
                codes = (str(r.get(k) or "") for k in ("addr_type", "leg_cd", "adm_cd"))
                out.append(Point(*xy, *codes))
            except (KeyError, TypeError, ValueError):
                continue
        return out

    def boundary(self, adm_cd: str, year: str, below: bool = False) -> list[dict]:
        """행정구역 경계 GeoJSON feature 목록(UTM-K).
        below 면 그 구역 바로 아래 단계(시군구 → 읍면동)"""
        features = self._call("/boundary/hadmarea.geojson", field="features",
                              accessToken=self._token(), year=year, adm_cd=adm_cd,
                              low_search="1" if below else "0")  # fmt: skip
        return features or []

    def building(self, road_addr: str) -> Point | None:
        """도로명주소 → 건물 좌표. 건물 단위로 찍힌 첫 결과만(행정 중심으로 떨어지면 None)"""
        for query in address_candidates(road_addr):
            if points := self.search(query):
                first = points[0]
                return first if first.addr_type == BUILDING else None
        return None
