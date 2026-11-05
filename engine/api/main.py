"""uvicorn api.main:app 으로 띄우는 FastAPI 앱."""

import json
from pathlib import Path
from typing import Annotated

from fastapi import Body, FastAPI
from fastapi.responses import JSONResponse
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from ai.argument.phrase import phrase
from ai.argument.prompt import article_sources

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
SCHEMAS = [
    json.loads(p.read_text(encoding="utf-8"))
    for p in [*(CONTRACTS / "c2/schemas").glob("*.json"), *(CONTRACTS / "ai").glob("*.json")]
]
REQUEST = Draft202012Validator(
    next(s for s in SCHEMAS if s["$id"].endswith("/ai/phrasing-request.schema.json")),
    registry=Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in SCHEMAS),
)

app = FastAPI(title="Issue Atlas engine")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/argument/phrase")
def argument_phrase(body: Annotated[dict, Body()]):
    """contracts/ai 문장화 요청 → 결과.

    요청이 계약을 어기면 422 INPUT_INVALID (어긴 칸 이름만, 값은 돌려주지 않는다).
    모델 호출이 길어 동기 함수로 둔다(FastAPI 가 스레드에서 돌린다).
    시간 제한은 contracts/ai 「시간 제한」.
    """
    problems = sorted(
        {
            f"{'/'.join(map(str, e.absolute_path)) or 'request'}: {e.validator}"
            for e in REQUEST.iter_errors(body)
        }
    )
    if problems:
        return JSONResponse(
            status_code=422, content={"reason_code": "INPUT_INVALID", "problems": problems[:20]}
        )
    return phrase(body["judgment"], article_sources(body["articles"]), body["card"]).result()
