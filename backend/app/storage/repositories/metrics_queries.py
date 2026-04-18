# app/storage/repositories/metrics_queries.py

from app.storage.models import StrategyMetricsModel


class StrategyMetricsQueryRepository:
    def get_by_run_id(self, session, run_id: str) -> StrategyMetricsModel | None:
        return (
            session.query(StrategyMetricsModel)
            .filter(StrategyMetricsModel.run_id == run_id)
            .first()
        )

    def list_by_run_ids(self, session, run_ids: list[str]) -> list[StrategyMetricsModel]:
        if not run_ids:
            return []

        return (
            session.query(StrategyMetricsModel)
            .filter(StrategyMetricsModel.run_id.in_(run_ids))
            .all()
        )