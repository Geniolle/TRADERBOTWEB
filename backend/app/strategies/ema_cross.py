# C:\Trader-bot\app\strategies\ema_cross.py

from __future__ import annotations

from decimal import Decimal

from app.indicators.ema import exponential_moving_average
from app.models.domain.candle import Candle
from app.models.domain.enums import CaseOutcome, StrategyCategory
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_definition import StrategyDefinition
from app.models.domain.strategy_run import StrategyRun
from app.services.case_snapshot import build_case_metadata_snapshot
from app.strategies.base import BaseStrategy
from app.strategies.decisions import CaseCloseDecision, TriggerDecision


DECIMAL_ZERO = Decimal("0")
DECIMAL_ONE = Decimal("1")
DECIMAL_HUNDRED = Decimal("100")


class EmaCrossStrategy(BaseStrategy):
    definition = StrategyDefinition(
        key="ema_cross",
        name="EMA Cross",
        version="2.0.0",
        description=(
            "Detecta cruzamentos entre EMA curta e longa, mas só abre a operação "
            "no candle seguinte quando houver confirmação do rompimento/continuidade."
        ),
        category=StrategyCategory.TREND_FOLLOWING,
    )

    def warmup_period(self, config: StrategyConfig) -> int:
        short_period = int(config.parameters.get("ema_short_period", 9))
        long_period = int(config.parameters.get("ema_long_period", 21))
        ema_200_period = int(config.parameters.get("ema_trend_period", 200))
        return max(short_period, long_period, ema_200_period, 220)

    def calculate_indicators(
        self,
        candles: list[Candle],
        config: StrategyConfig,
    ) -> dict:
        short_period = int(config.parameters.get("ema_short_period", 9))
        long_period = int(config.parameters.get("ema_long_period", 21))

        closes = [candle.close for candle in candles]

        short_ema = exponential_moving_average(closes, short_period)
        long_ema = exponential_moving_average(closes, long_period)

        return {
            "short_ema": short_ema,
            "long_ema": long_ema,
        }

    def _compute_ema_pair(
        self,
        candles: list[Candle],
        short_period: int,
        long_period: int,
    ) -> tuple[Decimal | None, Decimal | None]:
        if not candles:
            return (None, None)

        closes = [candle.close for candle in candles]
        short_ema = exponential_moving_average(closes, short_period)
        long_ema = exponential_moving_average(closes, long_period)

        return (short_ema, long_ema)

    def _build_cross_context(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> dict | None:
        if index < 1:
            return None

        short_period = int(config.parameters.get("ema_short_period", 9))
        long_period = int(config.parameters.get("ema_long_period", 21))

        previous_short, previous_long = self._compute_ema_pair(
            candles[:index],
            short_period,
            long_period,
        )
        current_short, current_long = self._compute_ema_pair(
            candles[: index + 1],
            short_period,
            long_period,
        )

        if (
            previous_short is None
            or previous_long is None
            or current_short is None
            or current_long is None
        ):
            return None

        crossed_up = previous_short <= previous_long and current_short > current_long
        crossed_down = previous_short >= previous_long and current_short < current_long

        if crossed_up:
            direction = "long"
            reason = "ema_bullish_cross_confirmed"
            setup_type = "ema_bullish_cross"
            cross_state = "bullish_cross"
        elif crossed_down:
            direction = "short"
            reason = "ema_bearish_cross_confirmed"
            setup_type = "ema_bearish_cross"
            cross_state = "bearish_cross"
        else:
            return None

        cross_candle = candles[index]

        return {
            "cross_index": index,
            "direction": direction,
            "reason": reason,
            "setup_type": setup_type,
            "cross_state": cross_state,
            "cross_candle_open_time": cross_candle.open_time,
            "cross_candle_close_time": cross_candle.close_time,
            "cross_candle_open": cross_candle.open,
            "cross_candle_high": cross_candle.high,
            "cross_candle_low": cross_candle.low,
            "cross_candle_close": cross_candle.close,
            "previous_short_ema": previous_short,
            "previous_long_ema": previous_long,
            "current_short_ema": current_short,
            "current_long_ema": current_long,
            "short_ema_period": short_period,
            "long_ema_period": long_period,
        }

    def _is_confirmation_candle_valid(
        self,
        confirmation_candle: Candle,
        cross_context: dict[str, object],
    ) -> bool:
        direction = str(cross_context["direction"]).strip().lower()

        cross_candle_high = Decimal(str(cross_context["cross_candle_high"]))
        cross_candle_low = Decimal(str(cross_context["cross_candle_low"]))
        cross_candle_close = Decimal(str(cross_context["cross_candle_close"]))
        current_short_ema = Decimal(str(cross_context["current_short_ema"]))
        current_long_ema = Decimal(str(cross_context["current_long_ema"]))

        if direction == "long":
            return (
                confirmation_candle.close > confirmation_candle.open
                and confirmation_candle.close > cross_candle_high
                and confirmation_candle.close > cross_candle_close
                and confirmation_candle.close > current_short_ema
                and confirmation_candle.close > current_long_ema
            )

        return (
            confirmation_candle.close < confirmation_candle.open
            and confirmation_candle.close < cross_candle_low
            and confirmation_candle.close < cross_candle_close
            and confirmation_candle.close < current_short_ema
            and confirmation_candle.close < current_long_ema
        )

    def _build_confirmation_context(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> dict | None:
        if index < 1:
            return None

        cross_index = index - 1
        cross_context = self._build_cross_context(candles, cross_index, config)
        if cross_context is None:
            return None

        confirmation_candle = candles[index]

        if not self._is_confirmation_candle_valid(confirmation_candle, cross_context):
            return None

        direction = str(cross_context["direction"]).strip().lower()
        setup_type = (
            "ema_bullish_cross_next_candle"
            if direction == "long"
            else "ema_bearish_cross_next_candle"
        )

        return {
            **cross_context,
            "setup_type": setup_type,
            "entry_mode": "confirm_next_candle",
            "confirmation_index": index,
            "confirmation_candle_open_time": confirmation_candle.open_time,
            "confirmation_candle_close_time": confirmation_candle.close_time,
            "confirmation_candle_open": confirmation_candle.open,
            "confirmation_candle_high": confirmation_candle.high,
            "confirmation_candle_low": confirmation_candle.low,
            "confirmation_candle_close": confirmation_candle.close,
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

        confirmation_context = self._build_confirmation_context(candles, index, config)
        if confirmation_context is None:
            return TriggerDecision(
                triggered=False,
                reason="next_candle_confirmation_not_met",
            )

        return TriggerDecision(
            triggered=True,
            reason="ema_cross_confirmed_by_next_candle",
            metadata={
                "direction": str(confirmation_context["direction"]),
                "trade_bias": str(confirmation_context["direction"]),
                "setup_type": str(confirmation_context["setup_type"]),
                "entry_mode": str(confirmation_context["entry_mode"]),
                "cross_reason": str(confirmation_context["reason"]),
                "cross_state": str(confirmation_context["cross_state"]),
                "cross_index": str(confirmation_context["cross_index"]),
                "cross_time": str(confirmation_context["cross_candle_close_time"]),
                "confirmation_index": str(confirmation_context["confirmation_index"]),
                "confirmation_time": str(
                    confirmation_context["confirmation_candle_close_time"]
                ),
                "previous_short_ema": str(confirmation_context["previous_short_ema"]),
                "previous_long_ema": str(confirmation_context["previous_long_ema"]),
                "current_short_ema": str(confirmation_context["current_short_ema"]),
                "current_long_ema": str(confirmation_context["current_long_ema"]),
            },
        )

    def create_case(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        run: StrategyRun,
    ) -> StrategyCase:
        confirmation_context = self._build_confirmation_context(candles, index, config)
        if confirmation_context is None:
            raise ValueError(
                "EMA Cross tentou criar case sem confirmação válida no próximo candle."
            )

        current_candle = candles[index]
        trade_bias = str(confirmation_context["direction"]).strip().lower()
        setup_type = str(confirmation_context["setup_type"])
        entry_mode = str(confirmation_context["entry_mode"])

        target_percent = Decimal(str(config.parameters.get("target_percent", "0.15")))
        stop_percent = Decimal(str(config.parameters.get("stop_percent", "0.10")))
        timeout_bars = int(config.parameters.get("timeout_bars", 12))

        entry_price = current_candle.close

        if trade_bias == "long":
            target_price = entry_price * (DECIMAL_ONE + (target_percent / DECIMAL_HUNDRED))
            invalidation_price = entry_price * (
                DECIMAL_ONE - (stop_percent / DECIMAL_HUNDRED)
            )
        else:
            target_price = entry_price * (DECIMAL_ONE - (target_percent / DECIMAL_HUNDRED))
            invalidation_price = entry_price * (
                DECIMAL_ONE + (stop_percent / DECIMAL_HUNDRED)
            )

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
            trigger_time=current_candle.close_time,
            trigger_candle_time=current_candle.close_time,
            entry_time=current_candle.close_time,
            entry_price=entry_price,
            target_price=target_price,
            invalidation_price=invalidation_price,
            timeout_at=timeout_at,
            metadata={
                "strategy_key": self.definition.key,
                "strategy_family": "trend_following",
                "trade_bias": trade_bias,
                "direction": trade_bias,
                "side": trade_bias,
                "setup_type": setup_type,
                "entry_mode": entry_mode,
                "cross_reason": str(confirmation_context["reason"]),
                "cross_state": str(confirmation_context["cross_state"]),
                "cross_index": str(confirmation_context["cross_index"]),
                "cross_time": str(confirmation_context["cross_candle_close_time"]),
                "confirmation_index": str(confirmation_context["confirmation_index"]),
                "confirmation_time": str(
                    confirmation_context["confirmation_candle_close_time"]
                ),
                "target_percent": str(target_percent),
                "stop_percent": str(stop_percent),
                "previous_short_ema": str(confirmation_context["previous_short_ema"]),
                "previous_long_ema": str(confirmation_context["previous_long_ema"]),
                "current_short_ema": str(confirmation_context["current_short_ema"]),
                "current_long_ema": str(confirmation_context["current_long_ema"]),
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
        trade_bias = str(updated_case.metadata.get("trade_bias", "long")).strip().lower()

        if trade_bias == "short":
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
        trade_bias = str(case.metadata.get("trade_bias", "long")).strip().lower()

        if trade_bias == "short":
            if candle.low <= case.target_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.HIT,
                    reason="target_percent_reached",
                    close_price=case.target_price,
                )

            if candle.high >= case.invalidation_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.FAIL,
                    reason="stop_percent_reached",
                    close_price=case.invalidation_price,
                )
        else:
            if candle.high >= case.target_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.HIT,
                    reason="target_percent_reached",
                    close_price=case.target_price,
                )

            if candle.low <= case.invalidation_price:
                return CaseCloseDecision(
                    should_close=True,
                    outcome=CaseOutcome.FAIL,
                    reason="stop_percent_reached",
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