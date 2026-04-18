# app/strategies/ff_fd.py

from decimal import Decimal

from app.indicators.bollinger import bollinger_bands
from app.models.domain.candle import Candle
from app.models.domain.enums import CaseOutcome, StrategyCategory
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_definition import StrategyDefinition
from app.models.domain.strategy_run import StrategyRun
from app.services.case_snapshot import build_case_metadata_snapshot
from app.strategies.base import BaseStrategy
from app.strategies.decisions import CaseCloseDecision, TriggerDecision


class FfFdStrategy(BaseStrategy):
    definition = StrategyDefinition(
        key="ff_fd",
        name="FF/FD",
        version="1.1.0",
        description=(
            "Fecho fora da Bollinger e fecho seguinte de volta para dentro, "
            "com alvo na banda média e invalidação na extrema do padrão."
        ),
        category=StrategyCategory.MEAN_REVERSION,
    )

    def warmup_period(self, config: StrategyConfig) -> int:
        period = int(config.parameters.get("bollinger_period", 20))
        return max(period, 40, 35)

    def calculate_indicators(
        self,
        candles: list[Candle],
        config: StrategyConfig,
    ) -> dict:
        period = int(config.parameters.get("bollinger_period", 20))
        stddev = Decimal(str(config.parameters.get("bollinger_stddev", 2)))

        closes = [candle.close for candle in candles]
        bands = bollinger_bands(
            values=closes,
            period=period,
            stddev_multiplier=stddev,
        )

        if bands is None:
            return {
                "lower_band": None,
                "middle_band": None,
                "upper_band": None,
            }

        lower_band, middle_band, upper_band = bands

        return {
            "lower_band": lower_band,
            "middle_band": middle_band,
            "upper_band": upper_band,
        }

    def _evaluate_pattern(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> dict | None:
        if index < 1:
            return None

        current_slice = candles[: index + 1]
        previous_slice = candles[:index]

        current_indicators = self.calculate_indicators(current_slice, config)
        previous_indicators = self.calculate_indicators(previous_slice, config)

        current_lower = current_indicators["lower_band"]
        current_upper = current_indicators["upper_band"]
        current_middle = current_indicators["middle_band"]
        previous_lower = previous_indicators["lower_band"]
        previous_upper = previous_indicators["upper_band"]

        if (
            current_lower is None
            or current_upper is None
            or current_middle is None
            or previous_lower is None
            or previous_upper is None
        ):
            return None

        previous_candle = candles[index - 1]
        current_candle = candles[index]

        buy_trigger = (
            previous_candle.close < previous_lower
            and current_candle.close > current_lower
        )

        if buy_trigger:
            return {
                "side": "buy",
                "trade_bias": "long",
                "previous_candle": previous_candle,
                "current_candle": current_candle,
                "middle_band": current_middle,
                "previous_lower_band": previous_lower,
                "current_lower_band": current_lower,
            }

        sell_trigger = (
            previous_candle.close > previous_upper
            and current_candle.close < current_upper
        )

        if sell_trigger:
            return {
                "side": "sell",
                "trade_bias": "short",
                "previous_candle": previous_candle,
                "current_candle": current_candle,
                "middle_band": current_middle,
                "previous_upper_band": previous_upper,
                "current_upper_band": current_upper,
            }

        return None

    def check_trigger(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> TriggerDecision:
        pattern = self._evaluate_pattern(candles, index, config)

        if pattern is None:
            if index < 1:
                return TriggerDecision(
                    triggered=False,
                    reason="not_enough_candles_for_confirmation",
                )

            return TriggerDecision(
                triggered=False,
                reason="trigger_conditions_not_met",
            )

        previous_candle = pattern["previous_candle"]
        current_candle = pattern["current_candle"]
        middle_band = pattern["middle_band"]
        side = pattern["side"]
        trade_bias = pattern["trade_bias"]

        if side == "buy":
            return TriggerDecision(
                triggered=True,
                reason="ff_fd_buy_confirmed",
                metadata={
                    "side": side,
                    "trade_bias": trade_bias,
                    "middle_band": str(middle_band),
                    "previous_close": str(previous_candle.close),
                    "current_close": str(current_candle.close),
                },
            )

        return TriggerDecision(
            triggered=True,
            reason="ff_fd_sell_confirmed",
            metadata={
                "side": side,
                "trade_bias": trade_bias,
                "middle_band": str(middle_band),
                "previous_close": str(previous_candle.close),
                "current_close": str(current_candle.close),
            },
        )

    def create_case(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        run: StrategyRun,
    ) -> StrategyCase:
        pattern = self._evaluate_pattern(candles, index, config)
        if pattern is None:
            raise ValueError("FF/FD case cannot be created without a valid trigger")

        previous_candle = pattern["previous_candle"]
        current_candle = pattern["current_candle"]
        middle_band = pattern["middle_band"]
        side = pattern["side"]
        trade_bias = pattern["trade_bias"]

        if side == "buy":
            invalidation_price = min(previous_candle.low, current_candle.low)
            setup_type = "ff_fd_buy"
        else:
            invalidation_price = max(previous_candle.high, current_candle.high)
            setup_type = "ff_fd_sell"

        timeout_bars = int(config.timeout_bars)
        timeout_at = None

        if timeout_bars > 0:
            candle_duration = current_candle.close_time - current_candle.open_time
            timeout_at = current_candle.close_time + (candle_duration * timeout_bars)

        snapshot = build_case_metadata_snapshot(
            candles=candles,
            index=index,
            config=config,
        )

        return StrategyCase(
            run_id=run.id or "run-placeholder",
            strategy_config_id=config.id or "config-placeholder",
            asset_id=run.asset_id,
            symbol=run.symbol,
            timeframe=run.timeframe,
            trigger_time=previous_candle.close_time,
            trigger_candle_time=previous_candle.close_time,
            entry_time=current_candle.close_time,
            entry_price=current_candle.close,
            target_price=middle_band,
            invalidation_price=invalidation_price,
            timeout_at=timeout_at,
            metadata={
                "strategy_key": self.definition.key,
                "strategy_family": "mean_reversion",
                "setup_type": setup_type,
                "side": side,
                "trade_bias": trade_bias,
                "middle_band": str(middle_band),
                "previous_candle_close": str(previous_candle.close),
                "current_candle_close": str(current_candle.close),
                "previous_candle_time": previous_candle.close_time.isoformat(),
                "confirmation_candle_time": current_candle.close_time.isoformat(),
                "analysis_snapshot": snapshot,
            },
        )

    def update_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> StrategyCase:
        updated_case = case.model_copy(deep=True)
        side = str(updated_case.metadata.get("side", "")).lower()

        if side == "buy":
            favorable_move = candle.high - updated_case.entry_price
            adverse_move = updated_case.entry_price - candle.low
        else:
            favorable_move = updated_case.entry_price - candle.low
            adverse_move = candle.high - updated_case.entry_price

        if favorable_move > updated_case.max_favorable_excursion:
            updated_case.max_favorable_excursion = favorable_move

        if adverse_move > updated_case.max_adverse_excursion:
            updated_case.max_adverse_excursion = adverse_move

        updated_case.bars_to_resolution += 1

        return updated_case

    def should_close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> CaseCloseDecision:
        side = str(case.metadata.get("side", "")).lower()

        if side == "buy":
            if candle.high >= case.target_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.HIT,
                    reason="target_hit_middle_band",
                    close_price=case.target_price,
                )

            if candle.low <= case.invalidation_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.FAIL,
                    reason="invalidation_hit_pattern_low",
                    close_price=case.invalidation_price,
                )
        else:
            if candle.low <= case.target_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.HIT,
                    reason="target_hit_middle_band",
                    close_price=case.target_price,
                )

            if candle.high >= case.invalidation_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.FAIL,
                    reason="invalidation_hit_pattern_high",
                    close_price=case.invalidation_price,
                )

        if case.timeout_at is not None and candle.close_time >= case.timeout_at:
            return CaseCloseDecision(
                should_close=True,
                outcome=CaseOutcome.TIMEOUT,
                reason="timeout_reached",
                close_price=candle.close,
            )

        return CaseCloseDecision(
            should_close=False,
            reason="case_remains_open",
        )

    def close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
        decision: CaseCloseDecision,
    ) -> StrategyCase:
        if not decision.should_close or decision.outcome is None:
            raise ValueError("close_case called without a valid close decision")

        updated_case = case.model_copy(deep=True)
        updated_case.status = updated_case.status.CLOSED
        updated_case.outcome = decision.outcome
        updated_case.close_time = candle.close_time
        updated_case.close_price = decision.close_price or candle.close

        updated_case.metadata = {
            **updated_case.metadata,
            "close_reason": decision.reason,
            **decision.metadata,
        }

        return updated_case