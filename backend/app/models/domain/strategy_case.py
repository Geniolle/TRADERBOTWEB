from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.domain.enums import CaseOutcome, CaseStatus


class StrategyCase(BaseModel):
    id: str | None = Field(default=None)
    run_id: str
    strategy_config_id: str
    asset_id: str | None = None
    symbol: str
    timeframe: str

    trigger_time: datetime
    trigger_candle_time: datetime
    entry_time: datetime
    entry_price: Decimal

    target_price: Decimal
    invalidation_price: Decimal
    timeout_at: datetime | None = None

    status: CaseStatus = CaseStatus.OPEN
    outcome: CaseOutcome | None = None

    close_time: datetime | None = None
    close_price: Decimal | None = None

    bars_to_resolution: int = 0
    max_favorable_excursion: Decimal = Decimal("0")
    max_adverse_excursion: Decimal = Decimal("0")

    metadata: dict = Field(default_factory=dict)