from pydantic import BaseModel, Field

from app.models.domain.enums import MarketType


class Asset(BaseModel):
    id: str | None = Field(default=None)
    symbol: str
    market_type: MarketType
    exchange: str | None = None
    base_currency: str | None = None
    quote_currency: str | None = None
    description: str | None = None
    is_active: bool = True