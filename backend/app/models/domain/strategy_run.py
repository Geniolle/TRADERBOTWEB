from datetime import datetime

from pydantic import BaseModel, Field

from app.models.domain.enums import RunMode, RunStatus


class StrategyRun(BaseModel):
    id: str | None = Field(default=None)
    strategy_key: str | None = None
    strategy_config_id: str
    mode: RunMode
    asset_id: str | None = None
    symbol: str
    timeframe: str
    start_at: datetime
    end_at: datetime | None = None
    status: RunStatus = RunStatus.PENDING
    total_candles_processed: int = 0
    total_cases_opened: int = 0
    total_cases_closed: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None