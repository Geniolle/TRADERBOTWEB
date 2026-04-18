from fastapi import APIRouter, HTTPException

from app.core.settings import get_settings
from app.engine.run_engine import RunEngine
from app.models.domain.candle import Candle
from app.models.domain.enums import RunMode
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_run import StrategyRun
from app.providers.factory import MarketDataProviderFactory
from app.registry.strategy_registry import build_strategy_registry
from app.schemas.batch_run import (
    BatchHistoricalRunItemResponse,
    BatchHistoricalRunRequest,
    BatchHistoricalRunResponse,
)
from app.schemas.run import build_metrics_response, build_run_response
from app.storage.database import SessionLocal
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.storage.repositories.candle_repository import CandleRepository
from app.storage.repositories.case_repository import StrategyCaseRepository
from app.storage.repositories.metrics_repository import StrategyMetricsRepository
from app.storage.repositories.run_repository import StrategyRunRepository
from app.utils.ids import generate_id

router = APIRouter(prefix="/batch-runs", tags=["batch-runs"])


def _map_db_rows_to_domain_candles(rows) -> list[Candle]:
    return [
        Candle(
            asset_id=row.asset_id,
            symbol=row.symbol,
            timeframe=row.timeframe,
            open_time=row.open_time,
            close_time=row.close_time,
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume,
            source=row.source,
        )
        for row in rows
    ]


@router.post("/historical", response_model=BatchHistoricalRunResponse)
def run_batch_historical(request: BatchHistoricalRunRequest) -> BatchHistoricalRunResponse:
    settings = get_settings()
    registry = build_strategy_registry()

    if not request.strategies:
        raise HTTPException(status_code=400, detail="At least one strategy is required")

    session = SessionLocal()
    try:
        db_candles = CandleQueryRepository().list_by_symbol_timeframe_range(
            session=session,
            symbol=request.symbol,
            timeframe=request.timeframe,
            start_at=request.start_at,
            end_at=request.end_at,
        )

        if db_candles:
            candles = _map_db_rows_to_domain_candles(db_candles)
        else:
            try:
                provider = MarketDataProviderFactory().get_provider(settings.market_data_provider)
                candles = provider.get_historical_candles(
                    symbol=request.symbol,
                    timeframe=request.timeframe,
                    start_at=request.start_at,
                    end_at=request.end_at,
                )
            except KeyError as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            if not candles:
                raise HTTPException(
                    status_code=400,
                    detail="No candles returned for the requested period",
                )

            CandleRepository().save_many(session, candles)

        if not candles:
            raise HTTPException(
                status_code=400,
                detail="No candles available for the requested period",
            )

        engine = RunEngine()
        results: list[BatchHistoricalRunItemResponse] = []

        for strategy_item in request.strategies:
            if not registry.has(strategy_item.strategy_key):
                raise HTTPException(
                    status_code=404,
                    detail=f"Strategy not found: {strategy_item.strategy_key}",
                )

            strategy = registry.get(strategy_item.strategy_key)

            config_id = generate_id("cfg")
            run_id = generate_id("run")

            config = StrategyConfig(
                id=config_id,
                strategy_key=strategy_item.strategy_key,
                name=f"{strategy_item.strategy_key}-historical",
                timeframe=request.timeframe,
                parameters=strategy_item.parameters,
                timeout_bars=strategy_item.timeout_bars,
                enabled=True,
            )

            run = StrategyRun(
                id=run_id,
                strategy_key=strategy_item.strategy_key,
                strategy_config_id=config.id,
                mode=RunMode.HISTORICAL,
                symbol=request.symbol,
                timeframe=request.timeframe,
                start_at=request.start_at,
                end_at=request.end_at,
            )

            result = engine.run(
                run=run,
                strategy=strategy,
                config=config,
                candles=candles,
            )
            result["run"].strategy_key = strategy_item.strategy_key

            StrategyRunRepository().save(session, result["run"])
            StrategyCaseRepository().save_many(session, result["closed_cases"])
            StrategyMetricsRepository().save(session, result["metrics"])

            results.append(
                BatchHistoricalRunItemResponse(
                    strategy_key=strategy_item.strategy_key,
                    run=build_run_response(result["run"]),
                    metrics=build_metrics_response(result["metrics"]),
                )
            )

        return BatchHistoricalRunResponse(
            symbol=request.symbol,
            timeframe=request.timeframe,
            start_at=request.start_at,
            end_at=request.end_at,
            total_strategies=len(request.strategies),
            results=results,
        )
    finally:
        session.close()