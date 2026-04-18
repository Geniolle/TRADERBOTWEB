from app.models.domain.strategy_run import StrategyRun
from app.storage.models import StrategyRunModel


class StrategyRunRepository:
    def save(self, session, run: StrategyRun) -> StrategyRunModel:
        strategy_key = getattr(run, "strategy_key", "")

        db_obj = StrategyRunModel(
            id=run.id,
            strategy_key=strategy_key,
            strategy_config_id=run.strategy_config_id,
            mode=run.mode.value,
            asset_id=run.asset_id,
            symbol=run.symbol,
            timeframe=run.timeframe,
            start_at=run.start_at,
            end_at=run.end_at,
            status=run.status.value,
            total_candles_processed=run.total_candles_processed,
            total_cases_opened=run.total_cases_opened,
            total_cases_closed=run.total_cases_closed,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )

        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj