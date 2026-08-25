# CLUSTERMAP — one container: FastAPI (uvicorn) serving the API under /api/v1 and the
# compiled Vite dashboard from dashboard/dist. Read-only, keyless: no DB, no RPC, no
# secrets — the whole dataset is the committed snapshot in data/.
#
# The source layout is preserved inside the image on purpose: src/clustermap/config.py
# resolves PROJECT_ROOT = parents[2] of itself and finds dashboard/dist and data/ from
# there, so the app runs as an editable install from /app exactly like `make run` does.

# ── stage 1: dashboard (Vite) ──
FROM node:22-alpine AS dashboard
WORKDIR /dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci                                   # dev deps too: `build` runs tsc --noEmit first
COPY dashboard/ ./
RUN npm run build                            # -> /dashboard/dist

# ── stage 2: runtime (Python + uv) ──
FROM python:3.13-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:0.10 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# Dependency layer: lockfile + the vendored, path-sourced SybilKit + the project's own
# package (uv installs clustermap itself editable, so src/ must exist at sync time).
COPY pyproject.toml uv.lock ./
COPY vendor/sybilkit vendor/sybilkit
COPY src src
RUN uv sync --frozen --no-dev

COPY data data
COPY --from=dashboard /dashboard/dist dashboard/dist

ENV CLUSTERMAP_HOST=0.0.0.0 \
    CLUSTERMAP_PORT=8766 \
    CLUSTERMAP_SNAPSHOT=data/curator_snapshot.json.gz
EXPOSE 8766
CMD ["/app/.venv/bin/clustermap"]
