"""FastAPI application factory and compiled-dashboard view."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .controllers.api import router
from .models.repository import CuratorRepository


def create_app(
    *,
    settings: Settings | None = None,
    repository: CuratorRepository | None = None,
) -> FastAPI:
    resolved = settings or Settings.from_env()
    app = FastAPI(
        title="CLUSTERMAP",
        description="Read-only CuratorWhitelist relationship map",
        version="0.1.0",
    )
    app.state.settings = resolved
    app.state.repository = repository or CuratorRepository(
        resolved.snapshot_path,
        eth_usd=resolved.eth_usd,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

    assets = resolved.dashboard_dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def dashboard(path: str):
        dist = resolved.dashboard_dist
        requested = (dist / path).resolve()
        if dist.is_dir() and requested.is_relative_to(dist.resolve()) and requested.is_file():
            return FileResponse(requested)
        index = dist / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse(
            {
                "name": "CLUSTERMAP",
                "status": "API ready; dashboard has not been built",
                "build": "cd dashboard && npm install && npm run build",
                "docs": "/docs",
            }
        )

    return app


app = create_app()

