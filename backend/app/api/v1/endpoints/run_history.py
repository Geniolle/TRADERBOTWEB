# app/api/v1/endpoints/run_history.py

from fastapi import APIRouter, Query

from app.schemas.run import StrategyRunResponse
from app.storage.database import SessionLocal
from app.storage.models import StrategyCaseModel, StrategyMetricsModel, StrategyRunModel
from app.storage.repositories.run_queries import StrategyRunQueryRepository

router = APIRouter(prefix="/run-history", tags=["run-history"])


@router.get("", response_model=list[StrategyRunResponse])
def list_run_history(
    symbol: str | None = Query(default=None),
    timeframe: str | None = Query(default=None),
    strategy_key: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[StrategyRunResponse]:
    session = SessionLocal()
    try:
        rows = StrategyRunQueryRepository().list_runs_by_filters(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            strategy_key=strategy_key,
            limit=limit,
        )

        return [
            StrategyRunResponse(
                id=row.id,
                strategy_key=getattr(row, "strategy_key", None),
                strategy_config_id=row.strategy_config_id,
                mode=row.mode,
                asset_id=row.asset_id,
                symbol=row.symbol,
                timeframe=row.timeframe,
                start_at=row.start_at,
                end_at=row.end_at,
                status=row.status,
                total_candles_processed=row.total_candles_processed,
                total_cases_opened=row.total_cases_opened,
                total_cases_closed=row.total_cases_closed,
                candles_count=row.total_candles_processed,
                cases_count=row.total_cases_closed,
                started_at=row.started_at,
                finished_at=row.finished_at,
            )
            for row in rows
        ]
    finally:
        session.close()


@router.delete("")
def clear_run_history() -> dict:
    session = SessionLocal()
    try:
        deleted_metrics = session.query(StrategyMetricsModel).delete()
        deleted_cases = session.query(StrategyCaseModel).delete()
        deleted_runs = session.query(StrategyRunModel).delete()
        session.commit()

        return {
            "ok": True,
            "deleted_runs": deleted_runs,
            "deleted_cases": deleted_cases,
            "deleted_metrics": deleted_metrics,
        }
    finally:
        session.close()