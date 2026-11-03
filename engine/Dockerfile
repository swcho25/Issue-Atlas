FROM python:3.13-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530 AS dependencies
RUN pip install --no-cache-dir uv==0.11.28
WORKDIR /app/engine
ENV UV_PROJECT_ENVIRONMENT=/app/.venv UV_PYTHON_DOWNLOADS=never
COPY engine/pyproject.toml engine/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.13-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/engine
COPY --from=dependencies /app/.venv /app/.venv
COPY --chown=10001:10001 engine/pipeline ./pipeline
COPY --chown=10001:10001 engine/ai ./ai
COPY --chown=10001:10001 contracts /app/contracts
USER 10001:10001
ENTRYPOINT ["python", "-m", "pipeline.collect"]
# Starting the image without an explicit collection command never contacts an API or DB.
CMD ["--help"]
