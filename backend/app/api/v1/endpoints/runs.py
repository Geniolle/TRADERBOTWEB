from logging import getLogger
from time import perf_counter

from fastapi import APIRouter, HTTPException

from app.core.settings import get_settings
from app.engine.run_engine import RunEngine
from app.models.domain.candle import Candle
from app.models.domain.enums import RunMode
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_run import StrategyRun
from app.providers.factory import MarketDataProviderFactory
from app.registry.strategy_registry import build_strategy_registry
from app.schemas.run import (
    HistoricalRunRequest,
    HistoricalRunResponse,
    build_historical_run_response,
)
from app.storage.database import SessionLocal
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.storage.repositories.candle_repository import CandleRepository
from app.storage.repositories.case_repository import StrategyCaseRepository
from app.storage.repositories.metrics_repository import StrategyMetricsRepository
from app.storage.repositories.run_repository import StrategyRunRepository
from app.utils.ids import generate_id

router = APIRouter(prefix="/runs", tags=["runs"])
logger = getLogger(__name__)


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


@router.post("/historical", response_model=HistoricalRunResponse)
def run_historical(request: HistoricalRunRequest) -> HistoricalRunResponse:
    started = perf_counter()
    logger.info(
        "[RUNS] START strategy=%s symbol=%s timeframe=%s start_at=%s end_at=%s",
        request.strategy_key,
        request.symbol,
        request.timeframe,
        request.start_at,
        request.end_at,
    )

    settings = get_settings()
    logger.info("[RUNS] SETTINGS provider=%s db=%s", settings.market_data_provider, settings.database_url)

    registry = build_strategy_registry()
    logger.info("[RUNS] REGISTRY keys=%s", registry.list_keys())

    if not registry.has(request.strategy_key):
        logger.error("[RUNS] STRATEGY_NOT_FOUND key=%s", request.strategy_key)
        raise HTTPException(
            status_code=404,
            detail=f"Strategy not found: {request.strategy_key}",
        )

    strategy = registry.get(request.strategy_key)
    logger.info("[RUNS] STRATEGY_OK key=%s", request.strategy_key)

    config_id = generate_id("cfg")
    run_id = generate_id("run")

    config = StrategyConfig(
        id=config_id,
        strategy_key=request.strategy_key,
        name=f"{request.strategy_key}-historical",
        timeframe=request.timeframe,
        parameters=request.parameters,
        timeout_bars=request.timeout_bars,
        enabled=True,
    )

    run = StrategyRun(
        id=run_id,
        strategy_config_id=config.id,
        mode=RunMode.HISTORICAL,
        symbol=request.symbol,
        timeframe=request.timeframe,
        start_at=request.start_at,
        end_at=request.end_at,
    )
    run.strategy_key = request.strategy_key

    session = SessionLocal()
    logger.info("[RUNS] DB_SESSION_OPENED")
    try:
        logger.info("[RUNS] DB_QUERY_CANDLES_BEGIN")
        db_query_started = perf_counter()
        db_candles = CandleQueryRepository().list_by_symbol_timeframe_range(
            session=session,
            symbol=request.symbol,
            timeframe=request.timeframe,
            start_at=request.start_at,
            end_at=request.end_at,
        )
        logger.info(
            "[RUNS] DB_QUERY_CANDLES_END rows=%s elapsed=%.3fs",
            len(db_candles) if db_candles else 0,
            perf_counter() - db_query_started,
        )

        if db_candles:
            logger.info("[RUNS] USING_DB_CANDLES")
            candles = _map_db_rows_to_domain_candles(db_candles)
            logger.info("[RUNS] DB_CANDLES_MAPPED count=%s", len(candles))
        else:
            logger.info("[RUNS] DB_EMPTY_FETCH_PROVIDER_BEGIN provider=%s", settings.market_data_provider)
            try:
                provider_started = perf_counter()
                provider = MarketDataProviderFactory().get_provider(settings.market_data_provider)
                logger.info("[RUNS] PROVIDER_INSTANCE=%s", provider.__class__.__name__)

                candles = provider.get_historical_candles(
                    symbol=request.symbol,
                    timeframe=request.timeframe,
                    start_at=request.start_at,
                    end_at=request.end_at,
                )
                logger.info(
                    "[RUNS] PROVIDER_FETCH_END candles=%s elapsed=%.3fs",
                    len(candles) if candles else 0,
                    perf_counter() - provider_started,
                )
            except KeyError as exc:
                logger.exception("[RUNS] PROVIDER_KEY_ERROR")
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            except ValueError as exc:
                logger.exception("[RUNS] PROVIDER_VALUE_ERROR")
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                logger.exception("[RUNS] PROVIDER_UNEXPECTED_ERROR")
                raise HTTPException(status_code=500, detail=f"Unexpected provider error: {exc}") from exc

            if not candles:
                logger.error("[RUNS] PROVIDER_RETURNED_NO_CANDLES")
                raise HTTPException(
                    status_code=400,
                    detail="No candles returned for the requested period",
                )

            logger.info("[RUNS] SAVE_CANDLES_BEGIN count=%s", len(candles))
            save_candles_started = perf_counter()
            CandleRepository().save_many(session, candles)
            logger.info(
                "[RUNS] SAVE_CANDLES_END elapsed=%.3fs",
                perf_counter() - save_candles_started,
            )

        if not candles:
            logger.error("[RUNS] NO_CANDLES_AVAILABLE_AFTER_ALL")
            raise HTTPException(
                status_code=400,
                detail="No candles available for the requested period",
            )

        logger.info("[RUNS] ENGINE_BEGIN candles=%s", len(candles))
        engine_started = perf_counter()
        engine = RunEngine()
        result = engine.run(
            run=run,
            strategy=strategy,
            config=config,
            candles=candles,
        )
        logger.info(
            "[RUNS] ENGINE_END closed_cases=%s open_cases=%s elapsed=%.3fs",
            len(result["closed_cases"]),
            len(result["open_cases"]),
            perf_counter() - engine_started,
        )
        result["run"].strategy_key = request.strategy_key

        logger.info("[RUNS] SAVE_RUN_BEGIN")
        StrategyRunRepository().save(session, result["run"])
        logger.info("[RUNS] SAVE_RUN_END")

        logger.info("[RUNS] SAVE_CASES_BEGIN count=%s", len(result["closed_cases"]))
        StrategyCaseRepository().save_many(session, result["closed_cases"])
        logger.info("[RUNS] SAVE_CASES_END")

        logger.info("[RUNS] SAVE_METRICS_BEGIN")
        StrategyMetricsRepository().save(session, result["metrics"])
        logger.info("[RUNS] SAVE_METRICS_END")
    finally:
        session.close()
        logger.info("[RUNS] DB_SESSION_CLOSED")

    logger.info("[RUNS] END total_elapsed=%.3fs", perf_counter() - started)
    return build_historical_run_response(result)
