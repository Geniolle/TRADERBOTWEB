import json

from fastapi import APIRouter, HTTPException

from app.engine.metrics_engine import MetricsEngine
from app.models.domain.enums import CaseOutcome, CaseStatus
from app.models.domain.strategy_case import StrategyCase
from app.schemas.run import StrategyMetricsResponse
from app.storage.database import SessionLocal
from app.storage.repositories.case_queries import StrategyCaseQueryRepository
from app.storage.repositories.metrics_queries import StrategyMetricsQueryRepository
from app.storage.repositories.metrics_repository import StrategyMetricsRepository
from app.storage.repositories.run_queries import StrategyRunQueryRepository

router = APIRouter(prefix="/run-metrics", tags=["run-metrics"])


def _map_case_row_to_domain(case_row) -> StrategyCase:
    return StrategyCase(
        id=case_row.id,
        run_id=case_row.run_id,
        strategy_config_id=case_row.strategy_config_id,
        asset_id=case_row.asset_id,
        symbol=case_row.symbol,
        timeframe=case_row.timeframe,
        trigger_time=case_row.trigger_time,
        trigger_candle_time=case_row.trigger_candle_time,
        entry_time=case_row.entry_time,
        entry_price=case_row.entry_price,
        target_price=case_row.target_price,
        invalidation_price=case_row.invalidation_price,
        timeout_at=case_row.timeout_at,
        status=CaseStatus(case_row.status),
        outcome=CaseOutcome(case_row.outcome) if case_row.outcome else None,
        close_time=case_row.close_time,
        close_price=case_row.close_price,
        bars_to_resolution=case_row.bars_to_resolution,
        max_favorable_excursion=case_row.max_favorable_excursion,
        max_adverse_excursion=case_row.max_adverse_excursion,
        metadata=json.loads(case_row.metadata_json or "{}"),
    )


@router.get("/{run_id}", response_model=StrategyMetricsResponse)
def get_run_metrics(run_id: str) -> StrategyMetricsResponse:
    session = SessionLocal()
    try:
        row = StrategyMetricsQueryRepository().get_by_run_id(session, run_id)

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Metrics not found for run_id: {run_id}",
            )

        return StrategyMetricsResponse(
            run_id=row.run_id,
            total_cases=row.total_cases,
            total_hits=row.total_hits,
            total_fails=row.total_fails,
            total_timeouts=row.total_timeouts,
            hit_rate=row.hit_rate,
            fail_rate=row.fail_rate,
            timeout_rate=row.timeout_rate,
            avg_bars_to_resolution=row.avg_bars_to_resolution,
            avg_time_to_resolution_seconds=row.avg_time_to_resolution_seconds,
            avg_mfe=row.avg_mfe,
            avg_mae=row.avg_mae,
        )
    finally:
        session.close()


@router.post("/{run_id}/recalculate", response_model=StrategyMetricsResponse)
def recalculate_run_metrics(run_id: str) -> StrategyMetricsResponse:
    session = SessionLocal()
    try:
        run_row = StrategyRunQueryRepository().get_by_id(session, run_id)

        if run_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Run not found: {run_id}",
            )

        case_rows = StrategyCaseQueryRepository().list_by_run_id(session, run_id)
        closed_cases = [_map_case_row_to_domain(row) for row in case_rows]

        metrics = MetricsEngine().build_metrics(
            run_id=run_id,
            closed_cases=closed_cases,
        )

        existing_row = StrategyMetricsQueryRepository().get_by_run_id(session, run_id)

        if existing_row is None:
            saved = StrategyMetricsRepository().save(session, metrics)
            return StrategyMetricsResponse(
                run_id=saved.run_id,
                total_cases=saved.total_cases,
                total_hits=saved.total_hits,
                total_fails=saved.total_fails,
                total_timeouts=saved.total_timeouts,
                hit_rate=saved.hit_rate,
                fail_rate=saved.fail_rate,
                timeout_rate=saved.timeout_rate,
                avg_bars_to_resolution=saved.avg_bars_to_resolution,
                avg_time_to_resolution_seconds=saved.avg_time_to_resolution_seconds,
                avg_mfe=saved.avg_mfe,
                avg_mae=saved.avg_mae,
            )

        existing_row.total_cases = metrics.total_cases
        existing_row.total_hits = metrics.total_hits
        existing_row.total_fails = metrics.total_fails
        existing_row.total_timeouts = metrics.total_timeouts
        existing_row.hit_rate = metrics.hit_rate
        existing_row.fail_rate = metrics.fail_rate
        existing_row.timeout_rate = metrics.timeout_rate
        existing_row.avg_bars_to_resolution = metrics.avg_bars_to_resolution
        existing_row.avg_time_to_resolution_seconds = metrics.avg_time_to_resolution_seconds
        existing_row.avg_mfe = metrics.avg_mfe
        existing_row.avg_mae = metrics.avg_mae

        session.commit()
        session.refresh(existing_row)

        return StrategyMetricsResponse(
            run_id=existing_row.run_id,
            total_cases=existing_row.total_cases,
            total_hits=existing_row.total_hits,
            total_fails=existing_row.total_fails,
            total_timeouts=existing_row.total_timeouts,
            hit_rate=existing_row.hit_rate,
            fail_rate=existing_row.fail_rate,
            timeout_rate=existing_row.timeout_rate,
            avg_bars_to_resolution=existing_row.avg_bars_to_resolution,
            avg_time_to_resolution_seconds=existing_row.avg_time_to_resolution_seconds,
            avg_mfe=existing_row.avg_mfe,
            avg_mae=existing_row.avg_mae,
        )
    finally:
        session.close()