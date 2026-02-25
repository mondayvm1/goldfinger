"""Goldfinger — FastAPI application factory."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .routes.dashboard import router as dashboard_router
from .routes.api import router as api_router

# Resolve paths relative to the project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_STATIC_DIR = _PROJECT_ROOT / "src" / "static"
_TEMPLATES_DIR = _PROJECT_ROOT / "src" / "templates"


def create_app() -> FastAPI:
    """Build and configure the FastAPI app."""
    app = FastAPI(
        title="Goldfinger",
        docs_url=None,   # Hide Swagger — Fort Knox
        redoc_url=None,   # Hide ReDoc — Fort Knox
        openapi_url=None, # Hide OpenAPI schema — Fort Knox
    )

    # Static files (CSS, JS)
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    # Templates
    app.state.templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))

    # Routes
    app.include_router(dashboard_router)
    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
