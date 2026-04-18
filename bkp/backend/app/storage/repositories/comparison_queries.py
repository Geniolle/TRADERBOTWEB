from app.storage.models import StrategyMetricsModel, StrategyRunModel


class StrategyComparisonQueryRepository:
    def compare_by_strategy(
        self,
        session,
        symbol: str | None = None,
        timeframe: str | None = None,
        strategy_key: str | None = None,
        limit: int = 100,
    ):
        query = (
            session.query(StrategyRunModel, StrategyMetricsModel)
            .join(StrategyMetricsModel, StrategyMetricsModel.run_id == StrategyRunModel.id)
            .filter(StrategyRunModel.strategy_key.is_not(None))
            .filter(StrategyRunModel.strategy_key != "")
        )

        if symbol:
            query = query.filter(StrategyRunModel.symbol == symbol)

        if timeframe:
            query = query.filter(StrategyRunModel.timeframe == timeframe)

        if strategy_key:
            query = query.filter(StrategyRunModel.strategy_key == strategy_key)

        rows = (
            query.order_by(StrategyRunModel.started_at.desc(), StrategyRunModel.id.desc())
            .limit(limit)
            .all()
        )

        grouped: dict[str, list[tuple]] = {}

        for run_row, metrics_row in rows:
            key = run_row.strategy_key
            grouped.setdefault(key, []).append((run_row, metrics_row))

        return grouped