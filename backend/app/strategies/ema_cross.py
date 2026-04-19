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

    def _to_int(self, value: object, default: int) -> int:
        if value is None:
            return default

        try:
            return int(Decimal(str(value)))
        except Exception:
            return default

    def _to_decimal(self, value: object, default: Decimal) -> Decimal:
        if value is None:
            return default

        try:
            return Decimal(str(value))
        except Exception:
            return default

    def _to_bool(self, value: object, default: bool) -> bool:
        if isinstance(value, bool):
            return value

        if value is None:
            return default

        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "y", "on", "sim"}:
            return True
        if normalized in {"0", "false", "no", "n", "off", "nao"}:
            return False
        return default

    def _normalize_text(self, value: object) -> str:
        return str(value or "").strip().lower()

    def _normalize_csv_set(
        self,
        raw: object,
        default_values: set[str],
    ) -> set[str]:
        if raw is None:
            return set(default_values)

        if isinstance(raw, str):
            tokens = [token.strip().lower() for token in raw.replace(";", ",").split(",")]
            normalized = {token for token in tokens if token}
            return normalized or set(default_values)

        if isinstance(raw, (list, tuple, set)):
            normalized = {str(item).strip().lower() for item in raw if str(item).strip()}
            return normalized or set(default_values)

        fallback = str(raw).strip().lower()
        return {fallback} if fallback else set(default_values)

    def _normalize_allowed_actions(self, raw: object) -> set[str]:
        return self._normalize_csv_set(
            raw=raw,
            default_values={"validar_entrada", "aceitar_com_confirmacao"},
        )

    def _extract_phase_3_confirmation(
        self,
        snapshot: dict[str, object],
    ) -> dict[str, object] | None:
        intelligence = snapshot.get("candlestick_intelligence")
        if not isinstance(intelligence, dict):
            return None

        phase_3 = intelligence.get("phase_3_confirmation")
        if not isinstance(phase_3, dict):
            return None

        return phase_3

    def _evaluate_extra_confirmation_gate(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        trade_bias: str,
    ) -> tuple[bool, dict[str, object]]:
        gate_enabled = self._to_bool(
            config.parameters.get("enable_extra_confirmation_filter"),
            True,
        )
        min_score = self._to_int(
            config.parameters.get("validation_min_confirmation_score"),
            8,
        )
        max_hard_blockers = self._to_int(
            config.parameters.get("validation_max_hard_blockers"),
            1,
        )
        allowed_actions = self._normalize_allowed_actions(
            config.parameters.get("validation_allowed_actions"),
        )

        gate_metadata: dict[str, object] = {
            "validation_filter_enabled": gate_enabled,
            "validation_min_confirmation_score": min_score,
            "validation_max_hard_blockers": max_hard_blockers,
            "validation_allowed_actions": sorted(allowed_actions),
        }

        if not gate_enabled:
            gate_metadata["validation_gate_passed"] = True
            gate_metadata["validation_gate_reason"] = "disabled"
            return True, gate_metadata

        try:
            snapshot = build_case_metadata_snapshot(
                candles=candles,
                index=index,
                config=config,
            )
        except Exception as exc:
            gate_metadata["validation_gate_passed"] = False
            gate_metadata["validation_gate_reason"] = "snapshot_unavailable"
            gate_metadata["validation_gate_error"] = str(exc)
            return False, gate_metadata

        phase_3 = self._extract_phase_3_confirmation(snapshot)
        if phase_3 is None:
            gate_metadata["validation_gate_passed"] = False
            gate_metadata["validation_gate_reason"] = "phase_3_unavailable"
            return False, gate_metadata

        confirmation_score = self._to_int(phase_3.get("confirmation_score"), -1)
        hard_blockers = self._to_int(phase_3.get("hard_blockers"), 999)
        recommended_action = str(phase_3.get("recommended_action") or "").strip().lower()
        reasons_against = phase_3.get("reasons_against")

        trend = snapshot.get("trend")
        if not isinstance(trend, dict):
            trend = {}

        structure = snapshot.get("structure")
        if not isinstance(structure, dict):
            structure = {}

        intelligence = snapshot.get("candlestick_intelligence")
        if not isinstance(intelligence, dict):
            intelligence = {}

        phase_1 = intelligence.get("phase_1_candle_features")
        if not isinstance(phase_1, dict):
            phase_1 = {}

        enable_market_regime_filter = self._to_bool(
            config.parameters.get("enable_market_regime_filter"),
            True,
        )
        require_ema200_slope_alignment = self._to_bool(
            config.parameters.get("require_ema200_slope_alignment"),
            True,
        )
        enable_range_edge_chop_filter = self._to_bool(
            config.parameters.get("enable_range_edge_chop_filter"),
            True,
        )
        range_edge_min_adx = self._to_decimal(
            config.parameters.get("range_edge_min_adx"),
            Decimal("18.3"),
        )
        range_edge_block_when_adx_rising = self._to_bool(
            config.parameters.get("range_edge_block_when_adx_rising"),
            False,
        )
        enable_trigger_quality_filter = self._to_bool(
            config.parameters.get("enable_trigger_quality_filter"),
            True,
        )
        range_edge_min_trigger_body_ratio = self._to_decimal(
            config.parameters.get("range_edge_min_trigger_body_ratio"),
            Decimal("0.60"),
        )
        range_edge_disallow_trigger_patterns = self._normalize_csv_set(
            config.parameters.get("range_edge_disallow_trigger_patterns"),
            {
                "balanced",
                "doji",
                "gravestone_doji",
                "dragonfly_doji",
                "spinning_top",
            },
        )

        normalized_direction = self._normalize_text(trade_bias)
        price_vs_ema_200 = self._normalize_text(trend.get("price_vs_ema_200"))
        ema_200_slope = self._normalize_text(trend.get("ema_200_slope"))
        entry_location = self._normalize_text(structure.get("entry_location"))
        adx_value = self._to_decimal(
            trend.get("adx_14") if trend.get("adx_14") is not None else trend.get("adx"),
            Decimal("-1"),
        )
        adx_slope = self._normalize_text(trend.get("adx_slope"))
        trigger_pattern = self._normalize_text(phase_1.get("trigger_pattern"))
        trigger_body_ratio = self._to_decimal(
            phase_1.get("trigger_body_ratio"),
            Decimal("-1"),
        )

        gate_metadata.update(
            {
                "validation_confirmation_score": (
                    confirmation_score if confirmation_score >= 0 else None
                ),
                "validation_hard_blockers": hard_blockers,
                "validation_recommended_action": recommended_action or None,
                "validation_confirmation_label": phase_3.get("confirmation_label"),
                "validation_reasons_against": reasons_against,
                "validation_market_regime_filter_enabled": enable_market_regime_filter,
                "validation_require_ema200_slope_alignment": require_ema200_slope_alignment,
                "validation_range_edge_chop_filter_enabled": enable_range_edge_chop_filter,
                "validation_range_edge_min_adx": str(range_edge_min_adx),
                "validation_range_edge_block_when_adx_rising": (
                    range_edge_block_when_adx_rising
                ),
                "validation_trigger_quality_filter_enabled": enable_trigger_quality_filter,
                "validation_range_edge_min_trigger_body_ratio": str(
                    range_edge_min_trigger_body_ratio
                ),
                "validation_range_edge_disallow_trigger_patterns": sorted(
                    range_edge_disallow_trigger_patterns
                ),
                "validation_direction": normalized_direction or None,
                "validation_price_vs_ema_200": price_vs_ema_200 or None,
                "validation_ema_200_slope": ema_200_slope or None,
                "validation_entry_location": entry_location or None,
                "validation_adx": str(adx_value) if adx_value >= DECIMAL_ZERO else None,
                "validation_adx_slope": adx_slope or None,
                "validation_trigger_pattern": trigger_pattern or None,
                "validation_trigger_body_ratio": (
                    str(trigger_body_ratio) if trigger_body_ratio >= DECIMAL_ZERO else None
                ),
            }
        )

        rejection_reasons: list[str] = []

        def add_rejection(reason: str) -> None:
            if reason not in rejection_reasons:
                rejection_reasons.append(reason)

        score_ok = confirmation_score >= min_score
        blockers_ok = hard_blockers <= max_hard_blockers
        action_ok = recommended_action in allowed_actions

        if not score_ok:
            add_rejection("score_below_min")
        if not blockers_ok:
            add_rejection("too_many_hard_blockers")
        if not action_ok:
            add_rejection("action_not_allowed")

        if enable_market_regime_filter:
            if normalized_direction == "long":
                if price_vs_ema_200 != "above":
                    add_rejection("regime_long_not_above_ema200")
                if require_ema200_slope_alignment and ema_200_slope not in {"", "unknown", "up"}:
                    add_rejection("regime_long_ema200_slope_not_up")
            elif normalized_direction == "short":
                if price_vs_ema_200 != "below":
                    add_rejection("regime_short_not_below_ema200")
                if require_ema200_slope_alignment and ema_200_slope not in {
                    "",
                    "unknown",
                    "down",
                }:
                    add_rejection("regime_short_ema200_slope_not_down")

        if enable_range_edge_chop_filter and entry_location == "range_edge":
            if adx_value < range_edge_min_adx:
                add_rejection("range_edge_adx_below_min")
            if range_edge_block_when_adx_rising and adx_slope == "up":
                add_rejection("range_edge_adx_rising")

        if enable_trigger_quality_filter and entry_location == "range_edge":
            if (
                trigger_body_ratio >= DECIMAL_ZERO
                and trigger_body_ratio < range_edge_min_trigger_body_ratio
            ):
                add_rejection("range_edge_trigger_body_ratio_below_min")
            if trigger_pattern and trigger_pattern in range_edge_disallow_trigger_patterns:
                add_rejection("range_edge_trigger_pattern_filtered")

        gate_metadata["validation_rejection_reasons"] = rejection_reasons

        if not rejection_reasons:
            gate_metadata["validation_gate_passed"] = True
            gate_metadata["validation_gate_reason"] = "accepted"
            return True, gate_metadata

        gate_metadata["validation_gate_passed"] = False
        gate_metadata["validation_gate_reason"] = (
            "|".join(rejection_reasons) if rejection_reasons else "rejected"
        )
        return False, gate_metadata

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

        trigger_metadata: dict[str, object] = {
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
        }

        gate_passed, gate_metadata = self._evaluate_extra_confirmation_gate(
            candles=candles,
            index=index,
            config=config,
            trade_bias=str(confirmation_context["direction"]),
        )

        if not gate_passed:
            return TriggerDecision(
                triggered=False,
                reason="extra_confirmation_gate_not_met",
                metadata={
                    **trigger_metadata,
                    **gate_metadata,
                },
            )

        return TriggerDecision(
            triggered=True,
            reason="ema_cross_confirmed_by_next_candle",
            metadata={
                **trigger_metadata,
                **gate_metadata,
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
