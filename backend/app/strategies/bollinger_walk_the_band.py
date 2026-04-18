# app/strategies/bollinger_walk_the_band.py

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


class BollingerWalkTheBandStrategy(BaseStrategy):
    definition = StrategyDefinition(
        key="bollinger_walk_the_band",
        name="Bollinger Walk The Band",
        version="1.1.0",
        description=(
            "Detecta continuação quando o candle fecha na banda externa. "
            "A estratégia opera continuação na direção da banda, usa a middle "
            "band como invalidação estrutural e projeta alvo por múltiplo de risco."
        ),
        category=StrategyCategory.TREND_FOLLOWING,
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
        current_slice = candles[: index + 1]
        indicators = self.calculate_indicators(current_slice, config)

        lower_band = indicators["lower_band"]
        middle_band = indicators["middle_band"]
        upper_band = indicators["upper_band"]

        if lower_band is None or middle_band is None or upper_band is None:
            return TriggerDecision(
                triggered=False,
                reason="indicators_not_ready",
            )

        current_candle = candles[index]

        if current_candle.close >= upper_band:
            return TriggerDecision(
                triggered=True,
                reason="bollinger_walk_upper_band_long_confirmed",
                metadata={
                    "direction": "long",
                    "setup_type": "bb_walk_the_band",
                    "upper_band": str(upper_band),
                    "middle_band": str(middle_band),
                    "close": str(current_candle.close),
                },
            )

        if current_candle.close <= lower_band:
            return TriggerDecision(
                triggered=True,
                reason="bollinger_walk_lower_band_short_confirmed",
                metadata={
                    "direction": "short",
                    "setup_type": "bb_walk_the_band",
                    "lower_band": str(lower_band),
                    "middle_band": str(middle_band),
                    "close": str(current_candle.close),
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
        setup_type = str(trigger.metadata.get("setup_type", "bb_walk_the_band"))
        indicators = self.calculate_indicators(candles[: index + 1], config)

        middle_band = indicators["middle_band"]
        if middle_band is None:
            raise ValueError("middle_band is required to create a case")

        risk_reward = Decimal(str(config.parameters.get("risk_reward", "1.5")))
        if risk_reward <= 0:
            raise ValueError("risk_reward must be greater than zero")

        timeout_bars = int(config.timeout_bars)
        timeout_at = None

        if timeout_bars > 0:
            candle_duration = current_candle.close_time - current_candle.open_time
            timeout_at = current_candle.close_time + (candle_duration * timeout_bars)

        entry_price = current_candle.close

        if direction == "long":
            invalidation_price = middle_band
            risk = entry_price - invalidation_price
            if risk <= 0:
                raise ValueError("invalid long risk for bollinger walk the band")
            target_price = entry_price + (risk * risk_reward)
            trade_bias = "Compra"
        elif direction == "short":
            invalidation_price = middle_band
            risk = invalidation_price - entry_price
            if risk <= 0:
                raise ValueError("invalid short risk for bollinger walk the band")
            target_price = entry_price - (risk * risk_reward)
            trade_bias = "Venda"
        else:
            raise ValueError("invalid bollinger walk the band direction")

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
                "risk_reward": str(risk_reward),
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

        if direction == "long":
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
        direction = str(case.metadata.get("direction", "")).lower()

        if direction == "long":
            stop_hit = candle.low <= case.invalidation_price
            target_hit = candle.high >= case.target_price
        else:
            stop_hit = candle.high >= case.invalidation_price
            target_hit = candle.low <= case.target_price

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
                reason="target_hit_projected_rr",
                close_price=case.target_price,
            )

        if stop_hit:
            return CaseCloseDecision(
                should_close=True,
                outcome=CaseOutcome.FAIL,
                reason="invalidation_hit_middle_band",
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
