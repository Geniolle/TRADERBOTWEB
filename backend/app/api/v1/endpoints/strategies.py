from fastapi import APIRouter

from app.registry.strategy_registry import build_strategy_registry
from app.schemas.strategy import StrategyListItemResponse, build_strategy_list_item

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.get("", response_model=list[StrategyListItemResponse])
def list_strategies() -> list[StrategyListItemResponse]:
    registry = build_strategy_registry()
    strategies = registry.list_strategies()

    return [
        build_strategy_list_item(strategy.definition)
        for strategy in strategies
    ]