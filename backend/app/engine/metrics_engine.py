from decimal import Decimal

from app.models.domain.enums import CaseOutcome
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_metrics import StrategyMetrics


class MetricsEngine:
    def build_metrics(
        self,
        run_id: str,
        closed_cases: list[StrategyCase],
    ) -> StrategyMetrics:
        total_cases = len(closed_cases)

        total_hits = sum(1 for case in closed_cases if case.outcome == CaseOutcome.HIT)
        total_fails = sum(1 for case in closed_cases if case.outcome == CaseOutcome.FAIL)
        total_timeouts = sum(1 for case in closed_cases if case.outcome == CaseOutcome.TIMEOUT)

        if total_cases == 0:
            return StrategyMetrics(run_id=run_id)

        total_cases_decimal = Decimal(total_cases)

        hit_rate = (Decimal(total_hits) / total_cases_decimal) * Decimal("100")
        fail_rate = (Decimal(total_fails) / total_cases_decimal) * Decimal("100")
        timeout_rate = (Decimal(total_timeouts) / total_cases_decimal) * Decimal("100")

        avg_bars_to_resolution = (
            sum(Decimal(case.bars_to_resolution) for case in closed_cases) / total_cases_decimal
        )

        avg_mfe = (
            sum(case.max_favorable_excursion for case in closed_cases) / total_cases_decimal
        )

        avg_mae = (
            sum(case.max_adverse_excursion for case in closed_cases) / total_cases_decimal
        )

        resolved_cases = [
            case for case in closed_cases
            if case.close_time is not None and case.entry_time is not None
        ]

        if resolved_cases:
            avg_time_to_resolution_seconds = (
                sum(
                    Decimal((case.close_time - case.entry_time).total_seconds())
                    for case in resolved_cases
                )
                / Decimal(len(resolved_cases))
            )
        else:
            avg_time_to_resolution_seconds = Decimal("0")

        return StrategyMetrics(
            run_id=run_id,
            total_cases=total_cases,
            total_hits=total_hits,
            total_fails=total_fails,
            total_timeouts=total_timeouts,
            hit_rate=hit_rate,
            fail_rate=fail_rate,
            timeout_rate=timeout_rate,
            avg_bars_to_resolution=avg_bars_to_resolution,
            avg_time_to_resolution_seconds=avg_time_to_resolution_seconds,
            avg_mfe=avg_mfe,
            avg_mae=avg_mae,
        )