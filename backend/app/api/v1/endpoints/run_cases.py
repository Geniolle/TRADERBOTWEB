import json

from fastapi import APIRouter

from app.schemas.run import StrategyCaseResponse
from app.storage.database import SessionLocal
from app.storage.repositories.case_queries import StrategyCaseQueryRepository

router = APIRouter(prefix="/run-cases", tags=["run-cases"])


@router.get("/{run_id}", response_model=list[StrategyCaseResponse])
def list_run_cases(run_id: str) -> list[StrategyCaseResponse]:
    session = SessionLocal()
    try:
        rows = StrategyCaseQueryRepository().list_by_run_id(session, run_id)

        return [
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
            for row in rows
        ]
    finally:
        session.close()