from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.run import StrategyMetricsResponse, StrategyRunResponse


class BatchStrategyItemRequest(BaseModel):
    strategy_key: str
    parameters: dict = Field(default_factory=dict)
    timeout_bars: int = 0


class BatchHistoricalRunRequest(BaseModel):
    symbol: str
    timeframe: str
    start_at: datetime
    end_at: datetime
    strategies: list[BatchStrategyItemRequest]


class BatchHistoricalRunItemResponse(BaseModel):
    strategy_key: str
    run: StrategyRunResponse
    metrics: StrategyMetricsResponse


class BatchHistoricalRunResponse(BaseModel):
    symbol: str
    timeframe: str
    start_at: datetime
    end_at: datetime
    total_strategies: int
    results: list[BatchHistoricalRunItemResponse]