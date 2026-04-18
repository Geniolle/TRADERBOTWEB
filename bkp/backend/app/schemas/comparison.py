from decimal import Decimal

from pydantic import BaseModel


class StrategyComparisonItemResponse(BaseModel):
    strategy_key: str
    total_runs: int
    total_cases: int
    total_hits: int
    total_fails: int
    total_timeouts: int
    avg_hit_rate: Decimal
    avg_fail_rate: Decimal
    avg_timeout_rate: Decimal
    avg_bars_to_resolution: Decimal
    avg_time_to_resolution_seconds: Decimal
    avg_mfe: Decimal
    avg_mae: Decimal


class StrategyComparisonResponse(BaseModel):
    symbol: str | None = None
    timeframe: str | None = None
    strategy_key: str | None = None
    total_groups: int
    results: list[StrategyComparisonItemResponse]