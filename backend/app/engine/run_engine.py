from app.engine.case_engine import CaseEngine
from app.engine.metrics_engine import MetricsEngine
from app.models.domain.candle import Candle
from app.models.domain.enums import CaseOutcome, CaseStatus, RunStatus
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_run import StrategyRun
from app.strategies.base import BaseStrategy


class RunEngine:
    def __init__(self) -> None:
        self.case_engine = CaseEngine()
        self.metrics_engine = MetricsEngine()

    def run(
        self,
        run: StrategyRun,
        strategy: BaseStrategy,
        config: StrategyConfig,
        candles: list[Candle],
    ) -> dict:
        working_run = run.model_copy(deep=True)
        working_run.status = RunStatus.RUNNING
        working_run.started_at = candles[0].open_time if candles else None

        open_cases: list[StrategyCase] = []
        closed_cases: list[StrategyCase] = []

        warmup = strategy.warmup_period(config)

        for index, candle in enumerate(candles):
            working_run.total_candles_processed += 1

            updated_open_cases: list[StrategyCase] = []

            for case in open_cases:
                processed_case, close_decision = self.case_engine.process_open_case(
                    case=case,
                    candle=candle,
                    strategy=strategy,
                    config=config,
                )

                if processed_case.status == CaseStatus.CLOSED:
                    closed_cases.append(processed_case)
                    working_run.total_cases_closed += 1
                else:
                    updated_open_cases.append(processed_case)

            open_cases = updated_open_cases

            if index + 1 < warmup:
                continue

            trigger_decision = strategy.check_trigger(
                candles=candles,
                index=index,
                config=config,
            )

            if trigger_decision.triggered:
                new_case = strategy.create_case(
                    candles=candles,
                    index=index,
                    config=config,
                    run=working_run,
                )
                open_cases.append(new_case)
                working_run.total_cases_opened += 1

        working_run.status = RunStatus.COMPLETED
        working_run.finished_at = candles[-1].close_time if candles else None

        if candles and open_cases:
            last_candle = candles[-1]
            finalized_open_cases: list[StrategyCase] = []

            for case in open_cases:
                updated_case = case.model_copy(deep=True)
                updated_case.status = CaseStatus.CLOSED
                updated_case.outcome = CaseOutcome.TIMEOUT
                updated_case.close_time = last_candle.close_time
                updated_case.close_price = last_candle.close
                updated_case.metadata = {
                    **updated_case.metadata,
                    "close_reason": "run_finished_with_case_still_open",
                }
                finalized_open_cases.append(updated_case)

            closed_cases.extend(finalized_open_cases)
            working_run.total_cases_closed += len(finalized_open_cases)
            open_cases = []

        metrics = self.metrics_engine.build_metrics(
            run_id=working_run.id or "run-placeholder",
            closed_cases=closed_cases,
        )

        return {
            "run": working_run,
            "open_cases": open_cases,
            "closed_cases": closed_cases,
            "metrics": metrics,
        }