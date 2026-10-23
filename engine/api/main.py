"""uvicorn api.main:app 으로 띄우는 FastAPI 앱."""

from fastapi import FastAPI

app = FastAPI(title="Issue Atlas engine")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
