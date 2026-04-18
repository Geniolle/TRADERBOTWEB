# app/api/routes/strategies.py

from fastapi import APIRouter

from ...strategies.catalog import STRATEGY_CATALOG

router = APIRouter()


@router.get("/strategies")
def list_strategies():
    return STRATEGY_CATALOG