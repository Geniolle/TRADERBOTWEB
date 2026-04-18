from fastapi import APIRouter

from app.core.settings import get_settings

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict:
    settings = get_settings()

    return {
        "status": "ok",
        "app_name": settings.app_name,
        "environment": settings.app_env,
    }