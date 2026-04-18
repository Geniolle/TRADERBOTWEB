from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.storage.models import StrategyMetric


class StrategyMetricsRepository:
    def list_by_run_id(self, session: Session, run_id: str) -> list[StrategyMetric]:
        stmt = (
            select(StrategyMetric)
            .where(StrategyMetric.run_id == run_id)
            .order_by(StrategyMetric.created_at.asc(), StrategyMetric.metric_key.asc())
        )
        return list(session.scalars(stmt).all())