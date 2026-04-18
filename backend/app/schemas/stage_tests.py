from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class StageTestStrategyOptionResponse(BaseModel):
    key: str = Field(..., description="Chave técnica da estratégia")
    label: str = Field(..., description="Nome visual da estratégia")
    description: str | None = Field(default=None, description="Descrição resumida")


class StageTestOptionItemResponse(BaseModel):
    symbol: str = Field(..., description="Símbolo normalizado")
    timeframe: str = Field(..., description="Timeframe disponível")
    candles_count: int = Field(..., description="Total de candles disponíveis")
    first_candle: str | None = Field(default=None, description="Primeiro candle disponível")
    last_candle: str | None = Field(default=None, description="Último candle disponível")


class StageTestOptionsResponse(BaseModel):
    strategies: list[StageTestStrategyOptionResponse]
    items: list[StageTestOptionItemResponse]
    refreshed_at: str


class StageTestRunRequest(BaseModel):
    symbol: str
    timeframe: str
    strategy: str
    min_candles: int = Field(default=1, ge=1)
    extra_args: list[str] = Field(default_factory=list)


class StageTestMetricsResponse(BaseModel):
    strategy_class: str | None = None
    runtime_strategy: str | None = None
    total_candles: int | None = None
    warmup: int | None = None
    triggers: int | None = None
    open_cases_final: int | None = None
    closed_cases: int | None = None
    hits: int | None = None
    fails: int | None = None
    timeouts: int | None = None
    others: int | None = None
    hit_rate: float | None = None
    fail_rate: float | None = None
    timeout_rate: float | None = None
    first_candle: str | None = None
    last_candle: str | None = None
    analysis: dict[str, Any] | None = None
    technical_analysis: dict[str, Any] | None = None
    validation_analysis: dict[str, Any] | None = None
    analysis_snapshot: dict[str, Any] | None = None
    cases: list[dict[str, Any]] | None = None


class StageTestRunResponse(BaseModel):
    ok: bool
    command: list[str]
    symbol: str
    timeframe: str
    strategy: str
    stdout: str
    stderr: str
    return_code: int
    metrics: StageTestMetricsResponse | dict[str, Any] | None = None
    analysis: dict[str, Any] | None = None
    cases: list[dict[str, Any]] | None = None