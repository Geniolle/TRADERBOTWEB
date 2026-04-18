from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.storage.models import StrategyCase


class StrategyCaseRepository:
    def list_by_run_id(self, session: Session, run_id: str) -> list[StrategyCase]:
        stmt = (
            select(StrategyCase)
            .where(StrategyCase.run_id == run_id)
            .order_by(StrategyCase.case_index.asc(), StrategyCase.created_at.asc())
        )
        return list(session.scalars(stmt).all())