# app/schemas/run.py

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_metrics import StrategyMetrics
from app.models.domain.strategy_run import StrategyRun


class HistoricalRunRequest(BaseModel):
    strategy_key: str
    symbol: str
    timeframe: str
    start_at: datetime
    end_at: datetime
    parameters: dict = Field(default_factory=dict)
    timeout_bars: int = 0


class CandleResponse(BaseModel):
    id: str | None = None
    asset_id: str | None = None
    symbol: str
    timeframe: str
    open_time: datetime
    close_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    source: str | None = None


class CandleListResponse(BaseModel):
    symbol: str
    timeframe: str
    mode: str = "full"
    count: int
    start_at: datetime
    end_at: datetime
    first_open_time: datetime | None = None
    last_close_time: datetime | None = None
    items: list[CandleResponse]


class StrategyRunResponse(BaseModel):
    id: str | None = None
    strategy_key: str | None = None
    strategy_config_id: str
    mode: str
    asset_id: str | None = None
    symbol: str
    timeframe: str
    start_at: datetime
    end_at: datetime | None = None
    status: str
    total_candles_processed: int
    total_cases_opened: int
    total_cases_closed: int
    candles_count: int = 0
    cases_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None


class StrategyCaseResponse(BaseModel):
    id: str | None = None
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
    status: str
    outcome: str | None = None
    close_time: datetime | None = None
    close_price: Decimal | None = None
    bars_to_resolution: int
    max_favorable_excursion: Decimal
    max_adverse_excursion: Decimal
    metadata: dict = Field(default_factory=dict)


class StrategyMetricsResponse(BaseModel):
    run_id: str
    total_cases: int
    total_hits: int
    total_fails: int
    total_timeouts: int
    hit_rate: Decimal
    fail_rate: Decimal
    timeout_rate: Decimal
    avg_bars_to_resolution: Decimal
    avg_time_to_resolution_seconds: Decimal
    avg_mfe: Decimal
    avg_mae: Decimal


class HistoricalRunResponse(BaseModel):
    run: StrategyRunResponse
    open_cases: list[StrategyCaseResponse]
    closed_cases: list[StrategyCaseResponse]
    metrics: StrategyMetricsResponse


def build_run_response(run: StrategyRun) -> StrategyRunResponse:
    return StrategyRunResponse(
        id=run.id,
        strategy_key=getattr(run, "strategy_key", None),
        strategy_config_id=run.strategy_config_id,
        mode=run.mode.value,
        asset_id=run.asset_id,
        symbol=run.symbol,
        timeframe=run.timeframe,
        start_at=run.start_at,
        end_at=run.end_at,
        status=run.status.value,
        total_candles_processed=run.total_candles_processed,
        total_cases_opened=run.total_cases_opened,
        total_cases_closed=run.total_cases_closed,
        candles_count=run.total_candles_processed,
        cases_count=run.total_cases_closed,
        started_at=run.started_at,
        finished_at=run.finished_at,
    )


def build_case_response(case: StrategyCase) -> StrategyCaseResponse:
    return StrategyCaseResponse(
        id=case.id,
        run_id=case.run_id,
        strategy_config_id=case.strategy_config_id,
        asset_id=case.asset_id,
        symbol=case.symbol,
        timeframe=case.timeframe,
        trigger_time=case.trigger_time,
        trigger_candle_time=case.trigger_candle_time,
        entry_time=case.entry_time,
        entry_price=case.entry_price,
        target_price=case.target_price,
        invalidation_price=case.invalidation_price,
        timeout_at=case.timeout_at,
        status=case.status.value,
        outcome=case.outcome.value if case.outcome else None,
        close_time=case.close_time,
        close_price=case.close_price,
        bars_to_resolution=case.bars_to_resolution,
        max_favorable_excursion=case.max_favorable_excursion,
        max_adverse_excursion=case.max_adverse_excursion,
        metadata=case.metadata,
    )


def build_metrics_response(metrics: StrategyMetrics) -> StrategyMetricsResponse:
    return StrategyMetricsResponse(
        run_id=metrics.run_id,
        total_cases=metrics.total_cases,
        total_hits=metrics.total_hits,
        total_fails=metrics.total_fails,
        total_timeouts=metrics.total_timeouts,
        hit_rate=metrics.hit_rate,
        fail_rate=metrics.fail_rate,
        timeout_rate=metrics.timeout_rate,
        avg_bars_to_resolution=metrics.avg_bars_to_resolution,
        avg_time_to_resolution_seconds=metrics.avg_time_to_resolution_seconds,
        avg_mfe=metrics.avg_mfe,
        avg_mae=metrics.avg_mae,
    )


def build_historical_run_response(result: dict) -> HistoricalRunResponse:
    return HistoricalRunResponse(
        run=build_run_response(result["run"]),
        open_cases=[build_case_response(case) for case in result["open_cases"]],
        closed_cases=[build_case_response(case) for case in result["closed_cases"]],
        metrics=build_metrics_response(result["metrics"]),
    )