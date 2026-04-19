from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class BinanceSpotOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=3)
    side: Literal["BUY", "SELL"]
    order_type: Literal["MARKET", "LIMIT"] = Field(alias="type")
    quantity: Decimal | None = None
    quote_order_qty: Decimal | None = Field(default=None, alias="quoteOrderQty")
    price: Decimal | None = None
    time_in_force: str | None = Field(default="GTC", alias="timeInForce")
    new_client_order_id: str | None = Field(default=None, alias="newClientOrderId")
    recv_window: int | None = Field(default=None, ge=1, le=60000, alias="recvWindow")
    test_mode: bool = Field(default=True, alias="testMode")

    model_config = ConfigDict(populate_by_name=True)


class BinanceOrderSafetyInfo(BaseModel):
    base_url: str
    require_testnet: bool
    is_testnet_url: bool


class BinanceSpotOrderResponse(BaseModel):
    ok: bool
    test_mode: bool
    endpoint: str
    symbol: str
    side: str
    type: str
    status_code: int
    safety: BinanceOrderSafetyInfo
    sent_params: dict[str, Any] = Field(default_factory=dict)
    exchange_response: dict[str, Any] = Field(default_factory=dict)


class BinanceSpotOrderHistoryResponse(BaseModel):
    ok: bool
    symbol: str
    limit: int
    count: int
    safety: BinanceOrderSafetyInfo
    items: list[dict[str, Any]] = Field(default_factory=list)


class BinanceSpotOrderProposalConfirmationRequest(BaseModel):
    symbol: str = Field(..., min_length=3)
    timeframe: str = Field(..., min_length=1)
    strategy_key: str = Field(..., min_length=1, alias="strategyKey")
    source: str | None = Field(default=None)
    candle_open_time: datetime | None = Field(default=None, alias="candleOpenTime")
    parameter_overrides: dict[str, Any] = Field(
        default_factory=dict,
        alias="parameterOverrides",
    )
    max_candles: int = Field(default=500, ge=100, le=5000, alias="maxCandles")

    model_config = ConfigDict(populate_by_name=True)


class BinanceSpotOrderProposalConfirmationResponse(BaseModel):
    ok: bool
    confirmed: bool
    reason: str
    message: str
    strategy_key: str
    runtime_strategy_key: str
    symbol: str
    timeframe: str
    source: str | None = None
    candles_used: int
    warmup_required: int
    evaluated_candle_open_time: datetime | None = None
    reference_candle_open_time: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
