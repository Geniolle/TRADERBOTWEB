# app/strategies/bollinger_reversal.py

from decimal import Decimal

from app.indicators.bollinger import bollinger_bands
from app.models.domain.candle import Candle
from app.models.domain.enums import CaseOutcome, StrategyCategory
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_definition import StrategyDefinition
from app.models.domain.strategy_run import StrategyRun
from app.strategies.analysis_snapshot_builder import build_analysis_snapshot
from app.strategies.base import BaseStrategy
from app.strategies.decisions import CaseCloseDecision, TriggerDecision


class BollingerReversalStrategy(BaseStrategy):
    definition = StrategyDefinition(
        key="bollinger_reversal",
        name="Bollinger Reversal",
        version="2.1.0",
        description=(
            "Detecta reversão por Bollinger em ambos os lados: "
            "fechou fora da banda e o candle seguinte fechou novamente dentro. "
            "O alvo é a média (middle band) e a invalidação fica no extremo "
            "do candle de confirmação."
        ),
        category=StrategyCategory.MEAN_REVERSION,
    )

    def warmup_period(self, config: StrategyConfig) -> int:
        period = int(config.parameters.get("bollinger_period", 20))
        return max(period, 40)

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

    def check_trigger(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> TriggerDecision:
        if index < 1:
            return TriggerDecision(
                triggered=False,
                reason="not_enough_candles_for_confirmation",
            )

        previous_slice = candles[:index]
        current_slice = candles[: index + 1]

        previous_indicators = self.calculate_indicators(previous_slice, config)
        current_indicators = self.calculate_indicators(current_slice, config)

        previous_lower = previous_indicators["lower_band"]
        previous_upper = previous_indicators["upper_band"]
        current_lower = current_indicators["lower_band"]
        current_middle = current_indicators["middle_band"]
        current_upper = current_indicators["upper_band"]

        if (
            previous_lower is None
            or previous_upper is None
            or current_lower is None
            or current_middle is None
            or current_upper is None
        ):
            return TriggerDecision(
                triggered=False,
                reason="indicators_not_ready",
            )

        previous_candle = candles[index - 1]
        current_candle = candles[index]

        previous_closed_above_upper = previous_candle.close > previous_upper
        current_closed_back_inside_from_above = current_candle.close < current_upper

        if previous_closed_above_upper and current_closed_back_inside_from_above:
            return TriggerDecision(
                triggered=True,
                reason="bollinger_reversal_short_confirmed",
                metadata={
                    "direction": "short",
                    "setup_type": "bb_reentry",
                    "previous_upper_band": str(previous_upper),
                    "current_upper_band": str(current_upper),
                    "middle_band": str(current_middle),
                    "previous_close": str(previous_candle.close),
                    "current_close": str(current_candle.close),
                    "confirmation_high": str(current_candle.high),
                    "confirmation_low": str(current_candle.low),
                },
            )

        previous_closed_below_lower = previous_candle.close < previous_lower
        current_closed_back_inside_from_below = current_candle.close > current_lower

        if previous_closed_below_lower and current_closed_back_inside_from_below:
            return TriggerDecision(
                triggered=True,
                reason="bollinger_reversal_long_confirmed",
                metadata={
                    "direction": "long",
                    "setup_type": "bb_reentry",
                    "previous_lower_band": str(previous_lower),
                    "current_lower_band": str(current_lower),
                    "middle_band": str(current_middle),
                    "previous_close": str(previous_candle.close),
                    "current_close": str(current_candle.close),
                    "confirmation_high": str(current_candle.high),
                    "confirmation_low": str(current_candle.low),
                },
            )

        return TriggerDecision(
            triggered=False,
            reason="trigger_conditions_not_met",
        )

    def create_case(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        run: StrategyRun,
    ) -> StrategyCase:
        current_candle = candles[index]
        trigger = self.check_trigger(candles, index, config)

        if not trigger.triggered:
            raise ValueError("trigger must be confirmed before creating a case")

        direction = str(trigger.metadata.get("direction", "")).lower()
        setup_type = str(trigger.metadata.get("setup_type", "bb_reentry"))
        indicators = self.calculate_indicators(candles[: index + 1], config)

        middle_band = indicators["middle_band"]
        if middle_band is None:
            raise ValueError("middle_band is required to create a case")

        timeout_bars = int(config.timeout_bars)
        timeout_at = None

        if timeout_bars > 0:
            candle_duration = current_candle.close_time - current_candle.open_time
            timeout_at = current_candle.close_time + (candle_duration * timeout_bars)

        if direction == "short":
            entry_price = current_candle.low
            target_price = middle_band
            invalidation_price = current_candle.high
            trade_bias = "Venda"
        elif direction == "long":
            entry_price = current_candle.high
            target_price = middle_band
            invalidation_price = current_candle.low
            trade_bias = "Compra"
        else:
            raise ValueError("invalid bollinger reversal direction")

        analysis_snapshot = build_analysis_snapshot(
            candles=candles,
            index=index,
            direction=direction,
            setup_type=setup_type,
        )

        return StrategyCase(
            run_id=run.id or "run-placeholder",
            strategy_config_id=config.id or "config-placeholder",
            asset_id=run.asset_id,
            symbol=run.symbol,
            timeframe=run.timeframe,
            trigger_time=current_candle.close_time,
            trigger_candle_time=current_candle.close_time,
            entry_time=current_candle.close_time,
            entry_price=entry_price,
            target_price=target_price,
            invalidation_price=invalidation_price,
            timeout_at=timeout_at,
            metadata={
                "strategy_key": self.definition.key,
                "setup_type": setup_type,
                "trade_bias": trade_bias,
                "direction": direction,
                "middle_band": str(middle_band),
                "confirmation_candle_high": str(current_candle.high),
                "confirmation_candle_low": str(current_candle.low),
                "analysis_snapshot": analysis_snapshot,
            },
        )

    def update_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> StrategyCase:
        updated_case = case.model_copy(deep=True)
        direction = str(updated_case.metadata.get("direction", "")).lower()

        if direction == "short":
            favorable_move = updated_case.entry_price - candle.low
            adverse_move = candle.high - updated_case.entry_price
        else:
            favorable_move = candle.high - updated_case.entry_price
            adverse_move = updated_case.entry_price - candle.low

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
        direction = str(case.metadata.get("direction", "")).lower()

        if direction == "short":
            stop_hit = candle.high >= case.invalidation_price
            target_hit = candle.low <= case.target_price
        else:
            stop_hit = candle.low <= case.invalidation_price
            target_hit = candle.high >= case.target_price

        if stop_hit and target_hit:
            return CaseCloseDecision(
                should_close=True,
                outcome=CaseOutcome.FAIL,
                reason="both_target_and_invalidation_hit_same_candle_conservative_fail",
                close_price=case.invalidation_price,
            )

        if target_hit:
            return CaseCloseDecision(
                should_close=True,
                outcome=CaseOutcome.HIT,
                reason="target_hit_middle_band",
                close_price=case.target_price,
            )

        if stop_hit:
            return CaseCloseDecision(
                should_close=True,
                outcome=CaseOutcome.FAIL,
                reason="invalidation_hit_confirmation_extreme",
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
