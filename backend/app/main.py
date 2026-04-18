from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.api.v1.router import api_router
from app.core.logging import get_logger, setup_logging
from app.core.settings import get_settings
from app.storage.database import Base, engine

import app.storage.models  # noqa: F401


def _resolve_sqlite_path(database_url: str) -> Path | None:
    if not database_url.startswith("sqlite:///"):
        return None

    raw_path = database_url.replace("sqlite:///", "", 1)
    return Path(raw_path).resolve()


def _get_sqlite_runtime_info(database_url: str) -> dict[str, Any]:
    path = _resolve_sqlite_path(database_url)

    info: dict[str, Any] = {
        "database_url": database_url,
        "engine_url": str(engine.url),
        "cwd": str(Path.cwd()),
        "sqlite_resolved_path": str(path) if path else None,
        "sqlite_exists": None,
        "sqlite_size_bytes": None,
        "sqlite_last_modified": None,
    }

    if path is None:
        return info

    exists = path.exists()
    info["sqlite_exists"] = exists

    if exists:
        stat = path.stat()
        info["sqlite_size_bytes"] = stat.st_size
        info["sqlite_last_modified"] = (
            Path(path).stat().st_mtime_ns
        )

    return info


setup_logging()

settings = get_settings()
logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    runtime_info = _get_sqlite_runtime_info(settings.database_url)

    logger.info("Application starting")
    logger.info("Environment: %s", settings.app_env)
    logger.info("Timezone: %s", settings.timezone)
    logger.info("App name: %s", settings.app_name)
    logger.info("Debug: %s", settings.app_debug)
    logger.info("Database URL: %s", runtime_info["database_url"])
    logger.info("Engine URL: %s", runtime_info["engine_url"])
    logger.info("Current working directory: %s", runtime_info["cwd"])
    logger.info("SQLite resolved path: %s", runtime_info["sqlite_resolved_path"])
    logger.info("SQLite exists: %s", runtime_info["sqlite_exists"])
    logger.info("SQLite size bytes: %s", runtime_info["sqlite_size_bytes"])
    logger.info("SQLite last modified (ns): %s", runtime_info["sqlite_last_modified"])

    try:
        table_names = inspect(engine).get_table_names()
        logger.info("Database tables: %s", ", ".join(table_names) if table_names else "(none)")
    except Exception as exc:
        logger.exception("Failed to inspect database tables: %s", exc)


@app.get("/health", tags=["health"])
def health() -> dict[str, Any]:
    runtime_info = _get_sqlite_runtime_info(settings.database_url)

    return {
        "ok": True,
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "debug": settings.app_debug,
        "timezone": settings.timezone,
        **runtime_info,
    }
