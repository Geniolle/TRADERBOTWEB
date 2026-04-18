from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class Candle(BaseModel):
    asset_id: str | None = Field(default=None)
    symbol: str
    timeframe: str
    open_time: datetime
    close_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal = Decimal("0")
    source: str | None = None