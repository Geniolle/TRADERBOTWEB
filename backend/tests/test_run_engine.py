from datetime import datetime, timedelta
from decimal import Decimal

from app.engine.run_engine import RunEngine
from app.models.domain.candle import Candle
from app.models.domain.enums import CaseOutcome, CaseStatus, RunMode
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_run import StrategyRun
from app.strategies.base import BaseStrategy
from app.strategies.decisions import CaseCloseDecision, TriggerDecision


def build_candle(
    *,
    open_time: datetime,
    close_time: datetime,
    open_price: str,
    high_price: str,
    low_price: str,
    close_price: str,
) -> Candle:
    return Candle(
        symbol="AAPL",
        timeframe="1h",
        open_time=open_time,
        close_time=close_time,
        open=Decimal(open_price),
        high=Decimal(high_price),
        low=Decimal(low_price),
        close=Decimal(close_price),
        volume=Decimal("1000"),
    )


def build_run() -> StrategyRun:
    return StrategyRun(
        id="run-test-001",
        strategy_key="dummy_strategy",
        strategy_config_id="cfg-test-001",
        mode=RunMode.HISTORICAL,
        symbol="AAPL",
        timeframe="1h",
        start_at=datetime(2024, 1, 1, 9, 30),
        end_at=datetime(2024, 1, 1, 12, 30),
    )


def build_config() -> StrategyConfig:
    return StrategyConfig(
        id="cfg-test-001",
        strategy_key="dummy_strategy",
        name="dummy-strategy",
        timeframe="1h",
        timeout_bars=10,
        enabled=True,
    )


class _BaseDummyStrategy(BaseStrategy):
    definition = None

    def warmup_period(self, config: StrategyConfig) -> int:
        return 1

    def calculate_indicators(
        self,
        candles: list[Candle],
        config: StrategyConfig,
    ) -> dict:
        return {}

    def create_case(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        run: StrategyRun,
    ) -> StrategyCase:
        current_candle = candles[index]

        return StrategyCase(
            id="case-test-001",
            run_id=run.id or "run-placeholder",
            strategy_config_id=config.id or "cfg-placeholder",
            asset_id=run.asset_id,
            symbol=run.symbol,
            timeframe=run.timeframe,
            trigger_time=current_candle.close_time,
            trigger_candle_time=current_candle.close_time,
            entry_time=current_candle.close_time,
            entry_price=current_candle.close,
            target_price=current_candle.close + Decimal("2"),
            invalidation_price=current_candle.close - Decimal("2"),
            timeout_at=current_candle.close_time + timedelta(hours=10),
            metadata={"strategy_key": "dummy_strategy"},
        )

    def update_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> StrategyCase:
        updated_case = case.model_copy(deep=True)
        updated_case.bars_to_resolution += 1
        updated_case.max_favorable_excursion += Decimal("1")
        updated_case.max_adverse_excursion += Decimal("0.5")
        return updated_case

    def close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
        decision: CaseCloseDecision,
    ) -> StrategyCase:
        updated_case = case.model_copy(deep=True)
        updated_case.status = CaseStatus.CLOSED
        updated_case.outcome = decision.outcome
        updated_case.close_time = candle.close_time
        updated_case.close_price = decision.close_price or candle.close
        updated_case.metadata = {
            **updated_case.metadata,
            "close_reason": decision.reason,
        }
        return updated_case


class ClosingStrategy(_BaseDummyStrategy):
    def check_trigger(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> TriggerDecision:
        return TriggerDecision(triggered=index == 0, reason="open_on_first_candle")

    def should_close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> CaseCloseDecision:
        return CaseCloseDecision(
            should_close=True,
            outcome=CaseOutcome.HIT,
            reason="target_reached_in_test",
            close_price=candle.close,
        )


class NeverClosingStrategy(_BaseDummyStrategy):
    def check_trigger(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> TriggerDecision:
        return TriggerDecision(triggered=index == 0, reason="open_on_first_candle")

    def should_close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> CaseCloseDecision:
        return CaseCloseDecision(
            should_close=False,
            reason="keep_open_in_test",
        )


def test_run_engine_closes_case_during_loop() -> None:
    engine = RunEngine()
    strategy = ClosingStrategy()
    config = build_config()
    run = build_run()

    candles = [
        build_candle(
            open_time=datetime(2024, 1, 1, 9, 30),
            close_time=datetime(2024, 1, 1, 10, 30),
            open_price="100",
            high_price="101",
            low_price="99",
            close_price="100.5",
        ),
        build_candle(
            open_time=datetime(2024, 1, 1, 10, 30),
            close_time=datetime(2024, 1, 1, 11, 30),
            open_price="100.5",
            high_price="103",
            low_price="100",
            close_price="102",
        ),
    ]

    result = engine.run(
        run=run,
        strategy=strategy,
        config=config,
        candles=candles,
    )

    assert result["run"].status.value == "completed"
    assert result["run"].total_cases_opened == 1
    assert result["run"].total_cases_closed == 1
    assert result["open_cases"] == []
    assert len(result["closed_cases"]) == 1

    closed_case = result["closed_cases"][0]
    assert closed_case.status == CaseStatus.CLOSED
    assert closed_case.outcome == CaseOutcome.HIT
    assert closed_case.metadata["close_reason"] == "target_reached_in_test"

    metrics = result["metrics"]
    assert metrics.total_cases == 1
    assert metrics.total_hits == 1
    assert metrics.total_fails == 0
    assert metrics.total_timeouts == 0


def test_run_engine_finalizes_open_case_as_timeout_at_end() -> None:
    engine = RunEngine()
    strategy = NeverClosingStrategy()
    config = build_config()
    run = build_run()

    candles = [
        build_candle(
            open_time=datetime(2024, 1, 1, 9, 30),
            close_time=datetime(2024, 1, 1, 10, 30),
            open_price="100",
            high_price="101",
            low_price="99",
            close_price="100.5",
        ),
        build_candle(
            open_time=datetime(2024, 1, 1, 10, 30),
            close_time=datetime(2024, 1, 1, 11, 30),
            open_price="100.5",
            high_price="101",
            low_price="100",
            close_price="100.8",
        ),
    ]

    result = engine.run(
        run=run,
        strategy=strategy,
        config=config,
        candles=candles,
    )

    assert result["run"].status.value == "completed"
    assert result["run"].total_cases_opened == 1
    assert result["run"].total_cases_closed == 1
    assert result["open_cases"] == []
    assert len(result["closed_cases"]) == 1

    closed_case = result["closed_cases"][0]
    assert closed_case.status == CaseStatus.CLOSED
    assert closed_case.outcome == CaseOutcome.TIMEOUT
    assert closed_case.close_time == candles[-1].close_time
    assert closed_case.close_price == candles[-1].close
    assert closed_case.metadata["close_reason"] == "run_finished_with_case_still_open"

    metrics = result["metrics"]
    assert metrics.total_cases == 1
    assert metrics.total_hits == 0
    assert metrics.total_fails == 0
    assert metrics.total_timeouts == 1