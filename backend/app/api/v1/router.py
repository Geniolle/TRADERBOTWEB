# G:\O meu disco\python\Trader-bot\app\api\v1\router.py

from fastapi import APIRouter

from app.api.v1.endpoints.batch_runs import router as batch_runs_router
from app.api.v1.endpoints.candles import router as candles_router
from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.providers import router as providers_router
from app.api.v1.endpoints.run_cases import router as run_cases_router
from app.api.v1.endpoints.run_details import router as run_details_router
from app.api.v1.endpoints.run_history import router as run_history_router
from app.api.v1.endpoints.run_metrics import router as run_metrics_router
from app.api.v1.endpoints.runs import router as runs_router
from app.api.v1.endpoints.stage_tests import router as stage_tests_router
from app.api.v1.endpoints.strategies import router as strategies_router
from app.api.v1.endpoints.ws import router as ws_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router, tags=["health"])
api_router.include_router(catalog_router)
api_router.include_router(
    stage_tests_router,
    prefix="/stage-tests",
    tags=["stage-tests"],
)
api_router.include_router(strategies_router)
api_router.include_router(runs_router)
api_router.include_router(batch_runs_router)
api_router.include_router(providers_router)
api_router.include_router(run_history_router)
api_router.include_router(run_metrics_router)
api_router.include_router(run_cases_router)
api_router.include_router(run_details_router)
api_router.include_router(candles_router)
api_router.include_router(ws_router)