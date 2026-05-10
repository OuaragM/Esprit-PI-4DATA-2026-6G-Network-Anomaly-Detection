# ── Stage 1: build dependencies ──────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY moe_ids/ moe_ids/
COPY mlops/ mlops/
COPY services/ services/
COPY scripts/ scripts/

# Optional local wheel cache — present on dev machines (~744 MB), absent in CI.
# COPY of an empty directory is allowed if the path exists; we create a stub
# so the COPY never fails when wheels/ isn't checked in.
RUN mkdir -p /tmp/__empty_wheels
COPY wheels* /tmp/__empty_wheels/wheels/
# When wheels are present pip installs from disk (fast, offline). When empty,
# the --find-links flag finds nothing and pip falls through to PyPI as usual.
RUN pip install --no-cache-dir --find-links=/tmp/__empty_wheels/wheels/ \
    --prefix=/install --timeout 180 \
    tensorflow xgboost scipy numpy pandas \
    fastapi "uvicorn[standard]" prometheus-client psycopg2-binary \
    pydantic-settings python-multipart structlog \
    "scikit-learn==1.5.1" "mlflow-skinny>=2.8" "httpx>=0.25"

# ── Stage 2: runtime image ────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

COPY --from=builder /install /usr/local
COPY --from=builder /build/moe_ids/ moe_ids/
COPY --from=builder /build/mlops/ mlops/
COPY --from=builder /build/services/ services/
COPY --from=builder /build/scripts/ scripts/
COPY --from=builder /build/pyproject.toml pyproject.toml

RUN mkdir -p /app/artefacts /app/logs/predictions && \
    chown -R appuser:appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ARTEFACTS_DIR=/app/artefacts \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"

CMD ["uvicorn", "services.inference.main:app", "--host", "0.0.0.0", "--port", "8000"]
