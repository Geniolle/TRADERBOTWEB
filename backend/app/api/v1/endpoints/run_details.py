# app/api/v1/endpoints/run_details.py

import json

from fastapi import APIRouter, HTTPException

from app.schemas.run import StrategyCaseResponse, StrategyMetricsResponse, StrategyRunResponse
from app.schemas.run_details import RunDetailsResponse
from app.storage.database import SessionLocal
from app.storage.repositories.case_queries import StrategyCaseQueryRepository
from app.storage.repositories.metrics_queries import StrategyMetricsQueryRepository
from app.storage.repositories.run_queries import StrategyRunQueryRepository

router = APIRouter(prefix="/run-details", tags=["run-details"])


@router.get("/{run_id}", response_model=RunDetailsResponse)
def get_run_details(run_id: str) -> RunDetailsResponse:
    session = SessionLocal()
    try:
        run_row = StrategyRunQueryRepository().get_by_id(session, run_id)

        if run_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Run not found: {run_id}",
            )

        metrics_row = StrategyMetricsQueryRepository().get_by_run_id(session, run_id)
        case_rows = StrategyCaseQueryRepository().list_by_run_id(session, run_id)

        run_response = StrategyRunResponse(
            id=run_row.id,
            strategy_key=getattr(run_row, "strategy_key", None),
            strategy_config_id=run_row.strategy_config_id,
            mode=run_row.mode,
            asset_id=run_row.asset_id,
            symbol=run_row.symbol,
            timeframe=run_row.timeframe,
            start_at=run_row.start_at,
            end_at=run_row.end_at,
            status=run_row.status,
            total_candles_processed=run_row.total_candles_processed,
            total_cases_opened=run_row.total_cases_opened,
            total_cases_closed=run_row.total_cases_closed,
            candles_count=run_row.total_candles_processed,
            cases_count=run_row.total_cases_closed,
            started_at=run_row.started_at,
            finished_at=run_row.finished_at,
        )

        metrics_response = None
        if metrics_row is not None:
            metrics_response = StrategyMetricsResponse(
                run_id=metrics_row.run_id,
                total_cases=metrics_row.total_cases,
                total_hits=metrics_row.total_hits,
                total_fails=metrics_row.total_fails,
                total_timeouts=metrics_row.total_timeouts,
                hit_rate=metrics_row.hit_rate,
                fail_rate=metrics_row.fail_rate,
                timeout_rate=metrics_row.timeout_rate,
                avg_bars_to_resolution=metrics_row.avg_bars_to_resolution,
                avg_time_to_resolution_seconds=metrics_row.avg_time_to_resolution_seconds,
                avg_mfe=metrics_row.avg_mfe,
                avg_mae=metrics_row.avg_mae,
            )

        cases_response = [
            StrategyCaseResponse(
                id=row.id,
                run_id=row.run_id,
                strategy_config_id=row.strategy_config_id,
                asset_id=row.asset_id,
                symbol=row.symbol,
                timeframe=row.timeframe,
                trigger_time=row.trigger_time,
                trigger_candle_time=row.trigger_candle_time,
                entry_time=row.entry_time,
                entry_price=row.entry_price,
                target_price=row.target_price,
                invalidation_price=row.invalidation_price,
                timeout_at=row.timeout_at,
                status=row.status,
                outcome=row.outcome,
                close_time=row.close_time,
                close_price=row.close_price,
                bars_to_resolution=row.bars_to_resolution,
                max_favorable_excursion=row.max_favorable_excursion,
                max_adverse_excursion=row.max_adverse_excursion,
                metadata=json.loads(row.metadata_json or "{}"),
            )
            for row in case_rows
        ]

        return RunDetailsResponse(
            run=run_response,
            metrics=metrics_response,
            cases=cases_response,
        )
    finally:
        session.close()