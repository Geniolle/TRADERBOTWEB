from app.storage.models import StrategyRunModel


class StrategyRunQueryRepository:
    def list_runs(self, session) -> list[StrategyRunModel]:
        return (
            session.query(StrategyRunModel)
            .order_by(StrategyRunModel.started_at.desc(), StrategyRunModel.id.desc())
            .all()
        )

    def get_by_id(self, session, run_id: str) -> StrategyRunModel | None:
        return (
            session.query(StrategyRunModel)
            .filter(StrategyRunModel.id == run_id)
            .first()
        )

    def list_runs_by_filters(
        self,
        session,
        symbol: str | None = None,
        timeframe: str | None = None,
        strategy_key: str | None = None,
        limit: int = 100,
    ) -> list[StrategyRunModel]:
        query = session.query(StrategyRunModel)

        if symbol:
            query = query.filter(StrategyRunModel.symbol == symbol)

        if timeframe:
            query = query.filter(StrategyRunModel.timeframe == timeframe)

        if strategy_key:
            query = query.filter(StrategyRunModel.strategy_key == strategy_key)

        return (
            query.order_by(StrategyRunModel.started_at.desc(), StrategyRunModel.id.desc())
            .limit(limit)
            .all()
        )