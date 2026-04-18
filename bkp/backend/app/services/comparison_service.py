from decimal import Decimal

from app.schemas.comparison import (
    StrategyComparisonItemResponse,
    StrategyComparisonResponse,
)
from app.storage.repositories.comparison_queries import StrategyComparisonQueryRepository


class ComparisonService:
    def __init__(
        self,
        repository: StrategyComparisonQueryRepository | None = None,
    ) -> None:
        self.repository = repository or StrategyComparisonQueryRepository()

    def compare_strategies(
        self,
        session,
        symbol: str | None = None,
        timeframe: str | None = None,
        strategy_key: str | None = None,
        limit: int = 100,
    ) -> StrategyComparisonResponse:
        grouped = self.repository.compare_by_strategy(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            strategy_key=strategy_key,
            limit=limit,
        )

        results: list[StrategyComparisonItemResponse] = []

        for key, items in grouped.items():
            total_runs = len(items)

            total_cases = sum((item[1].total_cases or 0) for item in items)
            total_hits = sum((item[1].total_hits or 0) for item in items)
            total_fails = sum((item[1].total_fails or 0) for item in items)
            total_timeouts = sum((item[1].total_timeouts or 0) for item in items)

            avg_hit_rate = self._avg(items, "hit_rate")
            avg_fail_rate = self._avg(items, "fail_rate")
            avg_timeout_rate = self._avg(items, "timeout_rate")
            avg_bars_to_resolution = self._avg(items, "avg_bars_to_resolution")
            avg_time_to_resolution_seconds = self._avg(
                items, "avg_time_to_resolution_seconds"
            )
            avg_mfe = self._avg(items, "avg_mfe")
            avg_mae = self._avg(items, "avg_mae")

            results.append(
                StrategyComparisonItemResponse(
                    strategy_key=key,
                    total_runs=total_runs,
                    total_cases=total_cases,
                    total_hits=total_hits,
                    total_fails=total_fails,
                    total_timeouts=total_timeouts,
                    avg_hit_rate=avg_hit_rate,
                    avg_fail_rate=avg_fail_rate,
                    avg_timeout_rate=avg_timeout_rate,
                    avg_bars_to_resolution=avg_bars_to_resolution,
                    avg_time_to_resolution_seconds=avg_time_to_resolution_seconds,
                    avg_mfe=avg_mfe,
                    avg_mae=avg_mae,
                )
            )

        results.sort(
            key=lambda item: (item.avg_hit_rate, item.total_cases),
            reverse=True,
        )

        return StrategyComparisonResponse(
            symbol=symbol,
            timeframe=timeframe,
            strategy_key=strategy_key,
            total_groups=len(results),
            results=results,
        )

    def _avg(self, items: list[tuple], field_name: str) -> Decimal:
        values: list[Decimal] = []

        for _, metrics in items:
            if (metrics.total_cases or 0) <= 0:
                continue

            value = getattr(metrics, field_name, None)
            if value is not None:
                values.append(Decimal(value))

        if not values:
            return Decimal("0")

        return sum(values) / Decimal(len(values))