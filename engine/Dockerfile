FROM python:3.13-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530 AS dependencies
RUN pip install --no-cache-dir uv==0.11.28
WORKDIR /app/engine
ENV UV_PROJECT_ENVIRONMENT=/app/.venv UV_PYTHON_DOWNLOADS=never
COPY engine/pyproject.toml engine/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.13-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530 AS base
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/engine
COPY --from=dependencies /app/.venv /app/.venv
COPY --chown=10001:10001 engine/ai ./ai
COPY --chown=10001:10001 contracts /app/contracts
USER 10001:10001

# 논증 문장화 API (S15P31C108-243). deploy/dev compose 의 engine 서비스가 `--target api` 로 쓴다.
# pipeline 은 싣지 않는다. 키는 실행 때 /app/.env(읽기 전용 연결)에서만 읽는다.
FROM base AS api
COPY --chown=10001:10001 engine/api ./api
EXPOSE 8000
ENTRYPOINT ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]

# 수집기 (기본 대상: --target 없이 빌드하면 이 이미지다)
FROM base AS collector
COPY --chown=10001:10001 engine/pipeline ./pipeline
ENTRYPOINT ["python", "-m", "pipeline.collect"]
# Starting the image without an explicit collection command never contacts an API or DB.
CMD ["--help"]
