from decimal import Decimal

from pydantic import BaseModel


class StrategyMetrics(BaseModel):
    run_id: str
    total_cases: int = 0
    total_hits: int = 0
    total_fails: int = 0
    total_timeouts: int = 0

    hit_rate: Decimal = Decimal("0")
    fail_rate: Decimal = Decimal("0")
    timeout_rate: Decimal = Decimal("0")

    avg_bars_to_resolution: Decimal = Decimal("0")
    avg_time_to_resolution_seconds: Decimal = Decimal("0")
    avg_mfe: Decimal = Decimal("0")
    avg_mae: Decimal = Decimal("0")