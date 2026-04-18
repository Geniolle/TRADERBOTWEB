from fastapi import APIRouter, Query

from app.schemas.comparison import StrategyComparisonResponse
from app.services.comparison_service import ComparisonService
from app.storage.database import SessionLocal
from app.storage.repositories.comparison_queries import StrategyComparisonQueryRepository

router = APIRouter(prefix="/comparisons", tags=["comparisons"])


@router.get("/strategies", response_model=StrategyComparisonResponse)
def compare_strategies(
    symbol: str | None = Query(default=None),
    timeframe: str | None = Query(default=None),
    strategy_key: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=5000),
) -> StrategyComparisonResponse:
    session = SessionLocal()
    try:
        service = ComparisonService(
            repository=StrategyComparisonQueryRepository(),
        )
        return service.compare_strategies(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            strategy_key=strategy_key,
            limit=limit,
        )
    finally:
        session.close()
