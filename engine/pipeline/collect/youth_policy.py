"""온통청년 청년정책(광주 5구 · 여수시) → 정책 × 지역마다 raw_record 한 행 + 장부(C1 문서, policy).

python -m pipeline.collect.youth_policy [--regions 12130 12210 …]
    → raw_record 저장, 건수 JSON (stdout). 키는 루트 .env 의 YOUTHCENTER_API_KEY

카드 근거 ③ 「기존 대응」의 원천이다(PRD FR-H1 · C3). 정책명 · 주관기관 · 분류 · 설명만 장부에 두고,
원천 행 전체(사업 기간 · 지원 대상 · 지원 내용 등)는 payload 에 그대로 둔다. 추출은 S15P31C108-136.
요청 규격(2025 신규): /go/ythip/getPlcy?apiKeyNm&pageNum&pageSize&rtnType=json&zipCd
(zipCd = 법정 시군구 코드). 응답은 result.youthPolicyList · result.pagging.totCount.
실호출 확인 전 규격이다(키 발급 대기).
"""

import argparse
import hashlib
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode
from urllib.request import build_opener
from uuid import uuid4

import psycopg
from dotenv import dotenv_values

from pipeline.refine.validate import validate

from .kosis import MAX_BYTES, CollectionError, NoRedirect, canonical
from .store import PostgresStore

ROOT = Path(__file__).resolve().parents[3]
ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
PAGE_SIZE = 100
MAX_PAGES = 50  # 지역 하나에 5,000건. 넘으면 끝을 못 찾은 것으로 보고 멈춘다
INTERVAL = 1.0  # 잇달아 부르면 403 이 난다는 보고가 있어 요청 사이에 둔다
# 잇단 호출 때 400 · 403 이 섞여 온다(2026-10-30 실호출). 400 · 403 · 5xx · 끊김은
# RETRY_WAIT × 시도 횟수만큼 기다려 ATTEMPTS 번까지 다시 부른다
ATTEMPTS = 3
RETRY_WAIT = 10.0
RETRYABLE = re.compile(r"YOUTHCENTER_(HTTP_(400|403|5\d\d)|NETWORK_ERROR)")
# 조회수처럼 받을 때마다 바뀌는 칸은 같은 정책인지 볼 때 뺀다
VOLATILE = ("inqCnt",)
# 온통청년은 2026-07-01 행정통합 뒤 새 법정 시군구 코드만 받는다(옛 46130 · 29110 은 0건,
# 2026-10-30 실호출). 여수시 12130, 광주 동구 12210 · 서구 12240 · 남구 12270 · 북구 12300 ·
# 광산구 12330 (place_code_map 의 새 코드)
REGIONS = ("12130", "12210", "12240", "12270", "12300", "12330")
DATETIME = re.compile(r"(\d{4})-?(\d{2})-?(\d{2})(?:[ T]?(\d{2}):?(\d{2}):?(\d{2}))?")


@dataclass(frozen=True)
class PolicyQuery:
    source_id: ClassVar[str] = "youthcenter"
    spec_id: ClassVar[str] = "youthcenter_policy_yeosu_gwangju"
    source_name: ClassVar[str] = "온통청년 청년정책"
    source_org: ClassVar[str] = "한국고용정보원"
    # 공공데이터포털 「이용허락범위 제한 없음」. P2 이용허락 표에 아직 없다(LICENSE_UNKNOWN 보류)
    license_type: ClassVar[str] = "공공데이터-이용허락범위제한없음"
    source_scope: ClassVar[str] = "metadata"
    evidence_class: ClassVar[str] = "existing_responses"
    method: ClassVar[str] = "api"
    collector_version: ClassVar[str] = "youthcenter-0.1.0"
    regions: tuple[str, ...] = REGIONS

    def identity(self):
        return {"endpoint": ENDPOINT, "page_size": PAGE_SIZE}

    def run_params(self):
        return {"regions": list(self.regions)}


def fetch_page(region: str, page: int, api_key: str) -> tuple[list[dict], int]:
    """지역 하나의 한 쪽 → (정책 목록, 전체 건수)."""
    params = {"apiKeyNm": api_key, "pageNum": page, "pageSize": PAGE_SIZE, "rtnType": "json"}
    url = ENDPOINT + "?" + urlencode(params | {"zipCd": region})
    try:
        with build_opener(NoRedirect()).open(url, timeout=30) as response:
            raw = response.read(MAX_BYTES + 1)
    except HTTPError as exc:
        raise CollectionError(f"YOUTHCENTER_HTTP_{exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise CollectionError("YOUTHCENTER_NETWORK_ERROR") from None
    if len(raw) > MAX_BYTES:
        raise CollectionError("YOUTHCENTER_RESPONSE_TOO_LARGE")
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeError, ValueError):
        raise CollectionError("YOUTHCENTER_INVALID_RESPONSE") from None
    return parse_page(data, api_key)


def parse_page(data, api_key: str) -> tuple[list[dict], int]:
    if api_key and api_key in unquote(json.dumps(data, ensure_ascii=False)):
        raise CollectionError("YOUTHCENTER_SECRET_IN_RESPONSE")
    if not isinstance(data, dict):
        raise CollectionError("YOUTHCENTER_INVALID_RESPONSE")
    if "resultCode" in data and str(data["resultCode"]) != "200":
        raise CollectionError("YOUTHCENTER_API_ERROR")
    try:
        result = data["result"] or {}
        rows = result.get("youthPolicyList") or []
        total = (result.get("pagging") or {}).get("totCount", len(rows))
        if type(total) is not int or not isinstance(rows, list) or len(rows) > PAGE_SIZE:
            raise ValueError
        if any(not isinstance(r, dict) for r in rows):
            raise ValueError
    except (KeyError, AttributeError, TypeError, ValueError):
        raise CollectionError("YOUTHCENTER_INVALID_RESPONSE") from None
    return rows, total


def search(query: PolicyQuery, api_key: str, fetch=fetch_page, sleep=time.sleep):
    """지역마다 모든 쪽 → ([(정책, 지역)], 호출 수). 한 지역에서 같은 정책은 처음 것만."""
    found, calls = {}, 0
    for region in query.regions:
        for page in range(1, MAX_PAGES + 1):
            for attempt in range(1, ATTEMPTS + 1):
                if calls:
                    sleep(INTERVAL)
                calls += 1
                try:
                    rows, total = fetch(region, page, api_key)
                    break
                except CollectionError as exc:
                    if attempt == ATTEMPTS or not RETRYABLE.fullmatch(str(exc)):
                        raise
                    sleep(RETRY_WAIT * attempt)
            for row in rows:
                if not isinstance(row.get("plcyNo"), str) or not row["plcyNo"]:
                    raise CollectionError("YOUTHCENTER_INVALID_POLICY")
                if not isinstance(row.get("plcyNm"), str) or not row["plcyNm"].strip():
                    raise CollectionError("YOUTHCENTER_INVALID_POLICY")
                found.setdefault((row["plcyNo"], region), row)
            # totCount 는 진행 표시로만 믿고, 빈 쪽 · 덜 찬 쪽이 끝이다
            if not rows or len(rows) < PAGE_SIZE or page * PAGE_SIZE >= total:
                break
        else:
            raise CollectionError("YOUTHCENTER_TOO_MANY_PAGES")
    return [(row, region) for (_, region), row in found.items()], calls


def _kst(value) -> str | None:
    """「2025-03-04 10:00:00」 · 「20250304」 같은 원천 시각 → 한국 시각 ISO. 모르는 모양은 None."""
    match = DATETIME.fullmatch(value.strip()) if isinstance(value, str) else None
    if not match:
        return None
    y, mo, d, h, mi, s = (int(g) if g else 0 for g in match.groups())
    try:
        return datetime(y, mo, d, h, mi, s).isoformat() + "+09:00"
    except ValueError:
        return None


def _texts(*values) -> list[str]:
    return list(dict.fromkeys(v.strip() for v in values if isinstance(v, str) and v.strip()))


def to_record(row: dict, region: str, run_id: str, at: str) -> tuple[dict, dict]:
    """온통청년 정책 한 건 × 지역 → (원본 payload, C1 정책 레코드)."""
    payload = {"youthcenter": row, "zipCd": region}
    keywords = row.get("plcyKywdNm")
    # 키워드는 부를 때마다 순서가 바뀐다(2026-10-30 실호출). 순서 없이 비교한다
    words = sorted(_texts(*keywords.split(","))) if isinstance(keywords, str) else []
    stable = {k: v for k, v in row.items() if k not in VOLATILE} | {"plcyKywdNm": words}
    # 같은 정책 · 같은 지역 · 같은 내용이면 같은 원본. 내용이 바뀌면 새 원본, 같은 dedup_key
    fingerprint = {"source_id": PolicyQuery.source_id, "zipCd": region, "policy": stable}
    excerpt = row.get("plcyExplnCn")
    record = {
        "source_id": PolicyQuery.source_id,
        "spec_id": PolicyQuery.spec_id,
        "raw_url": ENDPOINT + "?" + urlencode({"zipCd": region}),
        "file_name": None,
        "content_hash": "sha256:" + hashlib.sha256(canonical(fingerprint).encode()).hexdigest(),
        "collected_at": at,
        # 최초 등록 시각, 없으면 최종 수정 시각. 둘 다 모르면 None(collect 가 건너뛴다)
        "published_at": _kst(row.get("frstRegDt")) or _kst(row.get("lastMdfcnDt")),
        "observed_at": None,
        "observed_at_source": None,
        "observed_period_type": "none",
        "observed_period_start": None,
        "observed_period_end": None,
        # 정책의 대상 지역 중 이 레코드가 맡은 한 곳(온통청년 zipCd = 법정 시군구 코드)
        "place_code_raw": region,
        "place_code_system": "bjd",
        "place_id": None,
        "place_map_status": "unmapped",
        "geometry": None,
        "location_precision": "none",
        "geometry_role": None,
        "indicator_id": None,
        "value": None,
        "unit": None,
        "missing_reason": None,
        "is_provisional": False,
        "locator": {"plcyNo": row["plcyNo"], "zipCd": region},
        "dedup_key": f"youthcenter:{row['plcyNo']}:{region}",
        "license_type": PolicyQuery.license_type,
        "storage_scope": "metadata",
        "run_id": run_id,
        "collector_version": PolicyQuery.collector_version,
        "document": {
            "kind": "policy",
            "title": row["plcyNm"].strip(),
            "publisher": next(iter(_texts(row.get("sprvsnInstCdNm"))), None),
            "categories": _texts(row.get("lclsfNm"), row.get("mclsfNm")),
            "keywords": words,
            "entities": {"locations": [], "persons": [], "organizations": []},
            "excerpt": excerpt.strip() if isinstance(excerpt, str) and excerpt.strip() else None,
            # 원천이 상세 주소를 주지 않는다. 추측해 만들지 않는다
            "link": None,
            "fetch": None,
            "body": None,
        },
    }
    return payload, record


def collect(query: PolicyQuery, api_key: str, store, *, fetch=fetch_page, sleep=time.sleep):
    run_id = "youthcenter_" + uuid4().hex
    at = datetime.now(UTC).isoformat()
    store.start(query, run_id, at)
    stats = {"received": 0, "inserted": 0, "duplicates": 0, "no_published_at": 0, "calls": 0}
    stats |= query.run_params()
    try:
        if not api_key:
            raise CollectionError("YOUTHCENTER_KEY_MISSING")
        found, stats["calls"] = search(query, api_key, fetch, sleep)
        stats["received"] = len(found)
        rows, records = [], []
        for row, region in found:
            payload, record = to_record(row, region, run_id, at)
            if record["published_at"] is None:
                # C1 문서는 발행 시각 필수, 수집 시각으로 대신하지 않는다. 세어 두고 넣지 않는다
                stats["no_published_at"] += 1
                continue
            if validate(record):
                raise CollectionError("C1_INTAKE_VALIDATION_FAILED")
            rows.append(payload)
            records.append(record)
        try:
            saved = store.save(rows, records)
        except Exception:
            raise CollectionError("DB_WRITE_FAILED") from None
        stats["inserted"], stats["duplicates"] = saved, len(records) - saved
    except BaseException as exc:
        status = "aborted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed"
        code = str(exc) if isinstance(exc, CollectionError) else "YOUTHCENTER_COLLECTION_FAILED"
        store.finish(run_id, status, stats | {"error_code": code})
        raise CollectionError(code) from None
    store.finish(run_id, "ok", stats)
    return {"run_id": run_id, **stats}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--regions", nargs="+", choices=REGIONS, default=list(REGIONS))
    args = p.parse_args(argv)
    try:
        config = dotenv_values(ROOT / ".env", interpolate=False)
        if not config.get("DB_PASSWORD"):
            raise CollectionError("DB_PASSWORD_MISSING")
        with psycopg.connect(
            host=config.get("POSTGRES_HOST") or "localhost",
            port=config.get("POSTGRES_PORT") or "5432",
            dbname=config.get("DB_NAME") or "issue_atlas",
            user=config.get("DB_USERNAME") or "postgres",
            password=config["DB_PASSWORD"],
            connect_timeout=5,
            autocommit=True,
        ) as conn:
            query = PolicyQuery(tuple(args.regions))
            key = config.get("YOUTHCENTER_API_KEY") or ""
            result = collect(query, key, PostgresStore(conn))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except CollectionError as exc:
        print(str(exc), file=sys.stderr)
    except Exception:
        # DSN · 요청 URL · 응답 본문이 담길 수 있는 예외 문구는 출력하지 않는다
        print("YOUTHCENTER_CONFIGURATION_OR_IO_ERROR", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
