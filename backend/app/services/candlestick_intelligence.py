# C:\Trader-bot\app\services\candlestick_intelligence.py

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.models.domain.candle import Candle


DECIMAL_ZERO = Decimal("0")
DECIMAL_ONE = Decimal("1")
DECIMAL_TWO = Decimal("2")
DECIMAL_HALF = Decimal("0.5")

DECIMAL_POINT_10 = Decimal("0.10")
DECIMAL_POINT_12 = Decimal("0.12")
DECIMAL_POINT_15 = Decimal("0.15")
DECIMAL_POINT_20 = Decimal("0.20")
DECIMAL_POINT_25 = Decimal("0.25")
DECIMAL_POINT_30 = Decimal("0.30")
DECIMAL_POINT_35 = Decimal("0.35")
DECIMAL_POINT_40 = Decimal("0.40")
DECIMAL_POINT_45 = Decimal("0.45")
DECIMAL_POINT_50 = Decimal("0.50")
DECIMAL_POINT_55 = Decimal("0.55")
DECIMAL_POINT_60 = Decimal("0.60")
DECIMAL_POINT_65 = Decimal("0.65")
DECIMAL_POINT_70 = Decimal("0.70")
DECIMAL_POINT_75 = Decimal("0.75")
DECIMAL_POINT_80 = Decimal("0.80")


def decimal_to_str(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value.normalize(), "f")


def clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(value, max_value))


def safe_ratio(numerator: Decimal, denominator: Decimal) -> Decimal:
    if denominator == 0:
        return DECIMAL_ZERO
    return numerator / denominator


def normalize_direction(direction: str | None) -> str:
    normalized = str(direction or "").strip().lower()
    if normalized in {"buy", "long", "bullish", "compradora"}:
        return "buy"
    if normalized in {"sell", "short", "bearish", "vendedora"}:
        return "sell"
    return "buy"


def normalize_entry_location(entry_location: str | None) -> str:
    normalized = str(entry_location or "").strip().lower()

    if normalized in {"breakout", "rompimento"}:
        return "breakout"

    if normalized in {"pullback", "retest", "reteste"}:
        return "pullback"

    if normalized in {"mid_range", "range", "meio_range", "meio-de-range"}:
        return "mid_range"

    if normalized in {"range_edge", "borda_do_range"}:
        return "range_edge"

    return "unknown"


def normalize_cross_state(cross_state: str | None) -> str:
    normalized = str(cross_state or "").strip().lower()

    if normalized in {"bullish_cross", "cross_up", "bull_cross"}:
        return "bullish_cross"

    if normalized in {"bearish_cross", "cross_down", "bear_cross"}:
        return "bearish_cross"

    if normalized in {"bullish_above", "above"}:
        return "bullish_above"

    if normalized in {"bearish_below", "below"}:
        return "bearish_below"

    if normalized in {"flat"}:
        return "flat"

    return "unknown"


def candle_color(candle: Candle) -> str:
    if candle.close > candle.open:
        return "bullish"
    if candle.close < candle.open:
        return "bearish"
    return "neutral"


def candle_body(candle: Candle) -> Decimal:
    return abs(candle.close - candle.open)


def candle_range(candle: Candle) -> Decimal:
    return max(DECIMAL_ZERO, candle.high - candle.low)


def upper_wick(candle: Candle) -> Decimal:
    return max(DECIMAL_ZERO, candle.high - max(candle.open, candle.close))


def lower_wick(candle: Candle) -> Decimal:
    return max(DECIMAL_ZERO, min(candle.open, candle.close) - candle.low)


def body_ratio(candle: Candle) -> Decimal:
    return safe_ratio(candle_body(candle), candle_range(candle))


def upper_wick_ratio(candle: Candle) -> Decimal:
    return safe_ratio(upper_wick(candle), candle_range(candle))


def lower_wick_ratio(candle: Candle) -> Decimal:
    return safe_ratio(lower_wick(candle), candle_range(candle))


def close_position(candle: Candle) -> str:
    c_range = candle_range(candle)
    if c_range == 0:
        return "flat"

    distance_from_low = candle.close - candle.low
    ratio = safe_ratio(distance_from_low, c_range)

    if ratio >= DECIMAL_POINT_80:
        return "near_high"

    if ratio <= DECIMAL_POINT_20:
        return "near_low"

    if DECIMAL_POINT_40 <= ratio <= DECIMAL_POINT_60:
        return "mid"

    if ratio > DECIMAL_POINT_60:
        return "upper_half"

    return "lower_half"


def classify_single_candle_pattern(candle: Candle) -> str:
    c_body = candle_body(candle)
    c_range = candle_range(candle)
    c_body_ratio = body_ratio(candle)
    c_upper = upper_wick(candle)
    c_lower = lower_wick(candle)
    color = candle_color(candle)

    if c_range == 0:
        return "flat"

    if c_body_ratio <= DECIMAL_POINT_15:
        if c_lower >= c_body * DECIMAL_TWO and c_upper <= c_body:
            return "dragonfly_doji"
        if c_upper >= c_body * DECIMAL_TWO and c_lower <= c_body:
            return "gravestone_doji"
        if c_upper >= c_body and c_lower >= c_body:
            return "long_legged_doji"
        return "doji"

    if (
        c_body_ratio >= DECIMAL_POINT_75
        and c_upper <= c_body * DECIMAL_POINT_15
        and c_lower <= c_body * DECIMAL_POINT_15
    ):
        return "bullish_marubozu" if color == "bullish" else "bearish_marubozu"

    if c_body_ratio <= DECIMAL_POINT_35 and c_upper >= c_body * DECIMAL_TWO and c_lower >= c_body:
        return "spinning_top"

    if (
        c_body <= c_range * DECIMAL_POINT_35
        and c_lower >= c_body * DECIMAL_TWO
        and c_upper <= c_body * DECIMAL_HALF
    ):
        return "hammer"

    if (
        c_body <= c_range * DECIMAL_POINT_35
        and c_upper >= c_body * DECIMAL_TWO
        and c_lower <= c_body * DECIMAL_HALF
    ):
        return "shooting_star"

    if c_body_ratio >= DECIMAL_POINT_60:
        return "bullish_impulse" if color == "bullish" else "bearish_impulse"

    return "balanced"


def classify_strength_class(candle: Candle) -> str:
    pattern = classify_single_candle_pattern(candle)
    color = candle_color(candle)

    if pattern in {"bullish_marubozu", "bullish_impulse"}:
        return "bullish_force"

    if pattern in {"bearish_marubozu", "bearish_impulse"}:
        return "bearish_force"

    if pattern in {"dragonfly_doji", "gravestone_doji", "hammer", "shooting_star"}:
        return "rejection"

    if pattern in {"doji", "long_legged_doji", "spinning_top"}:
        return "indecision"

    if color == "bullish":
        return "bullish"

    if color == "bearish":
        return "bearish"

    return "neutral"


def build_candle_feature(candle: Candle, index_label: str) -> dict[str, Any]:
    return {
        "index_label": index_label,
        "open_time": candle.open_time.isoformat(),
        "close_time": candle.close_time.isoformat(),
        "open": decimal_to_str(candle.open),
        "high": decimal_to_str(candle.high),
        "low": decimal_to_str(candle.low),
        "close": decimal_to_str(candle.close),
        "color": candle_color(candle),
        "body_size": decimal_to_str(candle_body(candle)),
        "range_size": decimal_to_str(candle_range(candle)),
        "body_ratio": decimal_to_str(body_ratio(candle)),
        "upper_wick": decimal_to_str(upper_wick(candle)),
        "lower_wick": decimal_to_str(lower_wick(candle)),
        "upper_wick_ratio": decimal_to_str(upper_wick_ratio(candle)),
        "lower_wick_ratio": decimal_to_str(lower_wick_ratio(candle)),
        "close_position": close_position(candle),
        "pattern": classify_single_candle_pattern(candle),
        "strength_class": classify_strength_class(candle),
    }


def is_bullish(candle: Candle) -> bool:
    return candle.close > candle.open


def is_bearish(candle: Candle) -> bool:
    return candle.close < candle.open


def body_midpoint(candle: Candle) -> Decimal:
    return (candle.open + candle.close) / DECIMAL_TWO


def has_meaningful_body(candle: Candle, minimum_ratio: Decimal = DECIMAL_POINT_55) -> bool:
    return body_ratio(candle) >= minimum_ratio


def is_small_star_body(candle: Candle) -> bool:
    return body_ratio(candle) <= DECIMAL_POINT_35


def strong_bearish_context(a: Candle, b: Candle | None = None) -> bool:
    candles = [a] if b is None else [a, b]
    bearish_count = sum(1 for candle in candles if candle_color(candle) == "bearish")
    bearish_force_count = sum(
        1 for candle in candles if classify_strength_class(candle) == "bearish_force"
    )
    closes_lower = True
    if len(candles) == 2:
        closes_lower = candles[1].close <= candles[0].close

    return bearish_count == len(candles) and bearish_force_count >= 1 and closes_lower


def strong_bullish_context(a: Candle, b: Candle | None = None) -> bool:
    candles = [a] if b is None else [a, b]
    bullish_count = sum(1 for candle in candles if candle_color(candle) == "bullish")
    bullish_force_count = sum(
        1 for candle in candles if classify_strength_class(candle) == "bullish_force"
    )
    closes_higher = True
    if len(candles) == 2:
        closes_higher = candles[1].close >= candles[0].close

    return bullish_count == len(candles) and bullish_force_count >= 1 and closes_higher


def detect_bullish_engulfing(prev_candle: Candle, current_candle: Candle) -> bool:
    return (
        is_bearish(prev_candle)
        and is_bullish(current_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_50)
        and has_meaningful_body(current_candle, DECIMAL_POINT_55)
        and current_candle.open <= prev_candle.close
        and current_candle.close >= prev_candle.open
    )


def detect_bearish_engulfing(prev_candle: Candle, current_candle: Candle) -> bool:
    return (
        is_bullish(prev_candle)
        and is_bearish(current_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_50)
        and has_meaningful_body(current_candle, DECIMAL_POINT_55)
        and current_candle.open >= prev_candle.close
        and current_candle.close <= prev_candle.open
    )


def detect_bullish_harami(prev_candle: Candle, current_candle: Candle) -> bool:
    prev_low_body = min(prev_candle.open, prev_candle.close)
    prev_high_body = max(prev_candle.open, prev_candle.close)
    curr_low_body = min(current_candle.open, current_candle.close)
    curr_high_body = max(current_candle.open, current_candle.close)

    return (
        is_bearish(prev_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_60)
        and candle_body(current_candle) > 0
        and body_ratio(current_candle) <= DECIMAL_POINT_45
        and curr_low_body >= prev_low_body
        and curr_high_body <= prev_high_body
    )


def detect_bearish_harami(prev_candle: Candle, current_candle: Candle) -> bool:
    prev_low_body = min(prev_candle.open, prev_candle.close)
    prev_high_body = max(prev_candle.open, prev_candle.close)
    curr_low_body = min(current_candle.open, current_candle.close)
    curr_high_body = max(current_candle.open, current_candle.close)

    return (
        is_bullish(prev_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_60)
        and candle_body(current_candle) > 0
        and body_ratio(current_candle) <= DECIMAL_POINT_45
        and curr_low_body >= prev_low_body
        and curr_high_body <= prev_high_body
    )


def detect_piercing_line(prev_candle: Candle, current_candle: Candle) -> bool:
    return (
        is_bearish(prev_candle)
        and strong_bearish_context(prev_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_60)
        and is_bullish(current_candle)
        and has_meaningful_body(current_candle, DECIMAL_POINT_55)
        and current_candle.close > body_midpoint(prev_candle)
        and current_candle.close < prev_candle.open
    )


def detect_dark_cloud_cover(prev_candle: Candle, current_candle: Candle) -> bool:
    return (
        is_bullish(prev_candle)
        and strong_bullish_context(prev_candle)
        and has_meaningful_body(prev_candle, DECIMAL_POINT_60)
        and is_bearish(current_candle)
        and has_meaningful_body(current_candle, DECIMAL_POINT_55)
        and current_candle.close < body_midpoint(prev_candle)
        and current_candle.close > prev_candle.open
    )


def detect_morning_star(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bearish_context(a)
        and is_bearish(a)
        and has_meaningful_body(a, DECIMAL_POINT_60)
        and is_small_star_body(b)
        and candle_body(b) <= candle_body(a) * DECIMAL_HALF
        and is_bullish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close > body_midpoint(a)
        and c.close > b.close
    )


def detect_evening_star(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bullish_context(a)
        and is_bullish(a)
        and has_meaningful_body(a, DECIMAL_POINT_60)
        and is_small_star_body(b)
        and candle_body(b) <= candle_body(a) * DECIMAL_HALF
        and is_bearish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close < body_midpoint(a)
        and c.close < b.close
    )


def detect_three_inside_up(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bearish_context(a)
        and detect_bullish_harami(a, b)
        and is_bullish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close > max(a.open, a.close)
    )


def detect_three_inside_down(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bullish_context(a)
        and detect_bearish_harami(a, b)
        and is_bearish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close < min(a.open, a.close)
    )


def detect_three_outside_up(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bearish_context(a)
        and detect_bullish_engulfing(a, b)
        and is_bullish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close >= b.close
    )


def detect_three_outside_down(a: Candle, b: Candle, c: Candle) -> bool:
    return (
        strong_bullish_context(a)
        and detect_bearish_engulfing(a, b)
        and is_bearish(c)
        and has_meaningful_body(c, DECIMAL_POINT_55)
        and c.close <= b.close
    )


def detect_three_white_soldiers(window: list[Candle]) -> bool:
    if len(window) < 3:
        return False

    last_three = window[-3:]
    closes_higher = all(last_three[i].close >= last_three[i - 1].close for i in range(1, 3))
    return closes_higher and all(
        is_bullish(candle)
        and body_ratio(candle) >= DECIMAL_POINT_55
        and upper_wick_ratio(candle) <= DECIMAL_POINT_25
        for candle in last_three
    )


def detect_three_black_crows(window: list[Candle]) -> bool:
    if len(window) < 3:
        return False

    last_three = window[-3:]
    closes_lower = all(last_three[i].close <= last_three[i - 1].close for i in range(1, 3))
    return closes_lower and all(
        is_bearish(candle)
        and body_ratio(candle) >= DECIMAL_POINT_55
        and lower_wick_ratio(candle) <= DECIMAL_POINT_25
        for candle in last_three
    )


def detect_patterns(window: list[Candle]) -> dict[str, bool]:
    result = {
        "bullish_engulfing": False,
        "bearish_engulfing": False,
        "bullish_harami": False,
        "bearish_harami": False,
        "piercing_line": False,
        "dark_cloud_cover": False,
        "morning_star": False,
        "evening_star": False,
        "three_inside_up": False,
        "three_inside_down": False,
        "three_outside_up": False,
        "three_outside_down": False,
        "three_white_soldiers": False,
        "three_black_crows": False,
    }

    if len(window) >= 2:
        a = window[-2]
        b = window[-1]
        result["bullish_engulfing"] = detect_bullish_engulfing(a, b)
        result["bearish_engulfing"] = detect_bearish_engulfing(a, b)
        result["bullish_harami"] = detect_bullish_harami(a, b)
        result["bearish_harami"] = detect_bearish_harami(a, b)
        result["piercing_line"] = detect_piercing_line(a, b)
        result["dark_cloud_cover"] = detect_dark_cloud_cover(a, b)

    if len(window) >= 3:
        a = window[-3]
        b = window[-2]
        c = window[-1]
        result["morning_star"] = detect_morning_star(a, b, c)
        result["evening_star"] = detect_evening_star(a, b, c)
        result["three_inside_up"] = detect_three_inside_up(a, b, c)
        result["three_inside_down"] = detect_three_inside_down(a, b, c)
        result["three_outside_up"] = detect_three_outside_up(a, b, c)
        result["three_outside_down"] = detect_three_outside_down(a, b, c)
        result["three_white_soldiers"] = detect_three_white_soldiers(window)
        result["three_black_crows"] = detect_three_black_crows(window)

    return result


def active_pattern_names(patterns: dict[str, bool]) -> list[str]:
    return [name for name, active in patterns.items() if active]


def summarize_sequence_bias(window: list[Candle]) -> str:
    bullish_force = sum(
        1 for candle in window if classify_strength_class(candle) == "bullish_force"
    )
    bearish_force = sum(
        1 for candle in window if classify_strength_class(candle) == "bearish_force"
    )
    rejections = sum(
        1 for candle in window if classify_strength_class(candle) == "rejection"
    )

    if bullish_force >= bearish_force + 2:
        return "bullish_pressure"

    if bearish_force >= bullish_force + 2:
        return "bearish_pressure"

    if rejections >= 2:
        return "rejection_fight"

    return "mixed"


def detect_exhaustion(window: list[Candle], direction: str) -> bool:
    if len(window) < 4:
        return False

    previous_three = window[-4:-1]
    trigger_candle = window[-1]
    direction = normalize_direction(direction)

    if direction == "buy":
        previous_bearish_force = sum(
            1
            for candle in previous_three
            if classify_strength_class(candle) == "bearish_force"
        )
        trigger_pattern = classify_single_candle_pattern(trigger_candle)
        return previous_bearish_force >= 1 and trigger_pattern in {
            "hammer",
            "dragonfly_doji",
            "bullish_impulse",
            "bullish_marubozu",
        }

    previous_bullish_force = sum(
        1
        for candle in previous_three
        if classify_strength_class(candle) == "bullish_force"
    )
    trigger_pattern = classify_single_candle_pattern(trigger_candle)
    return previous_bullish_force >= 1 and trigger_pattern in {
        "shooting_star",
        "gravestone_doji",
        "bearish_impulse",
        "bearish_marubozu",
    }


def detect_impulsion(window: list[Candle], direction: str) -> bool:
    if not window:
        return False

    trigger_candle = window[-1]
    strength = classify_strength_class(trigger_candle)
    direction = normalize_direction(direction)

    if direction == "buy":
        return strength == "bullish_force"

    return strength == "bearish_force"


def detect_continuity(window: list[Candle], direction: str) -> bool:
    if len(window) < 3:
        return False

    direction = normalize_direction(direction)
    relevant = window[-4:-1]
    if len(relevant) < 2:
        return False

    if direction == "buy":
        bullish_force_count = sum(
            1
            for candle in relevant
            if candle_color(candle) == "bullish" and body_ratio(candle) >= DECIMAL_POINT_55
        )
        bullish_closes_higher = sum(
            1
            for i in range(1, len(relevant))
            if relevant[i].close >= relevant[i - 1].close
        )
        return bullish_force_count >= 2 and bullish_closes_higher >= 1

    bearish_force_count = sum(
        1
        for candle in relevant
        if candle_color(candle) == "bearish" and body_ratio(candle) >= DECIMAL_POINT_55
    )
    bearish_closes_lower = sum(
        1
        for i in range(1, len(relevant))
        if relevant[i].close <= relevant[i - 1].close
    )
    return bearish_force_count >= 2 and bearish_closes_lower >= 1


def detect_opposite_weakness(window: list[Candle], direction: str) -> bool:
    if len(window) < 3:
        return False

    previous_two = window[-3:-1]
    direction = normalize_direction(direction)

    if direction == "buy":
        return all(
            candle_color(candle) != "bearish"
            or upper_wick_ratio(candle) < lower_wick_ratio(candle)
            or body_ratio(candle) <= DECIMAL_POINT_40
            for candle in previous_two
        )

    return all(
        candle_color(candle) != "bullish"
        or lower_wick_ratio(candle) < upper_wick_ratio(candle)
        or body_ratio(candle) <= DECIMAL_POINT_40
        for candle in previous_two
    )


def build_force_reading(window: list[Candle], direction: str) -> dict[str, Any]:
    trigger_candle = window[-1]
    trigger_feature = build_candle_feature(trigger_candle, "trigger")

    prior_features = [
        build_candle_feature(candle, f"lookback_{index + 1}")
        for index, candle in enumerate(window[:-1])
    ]

    sequence_bias = summarize_sequence_bias(window)
    patterns = detect_patterns(window)

    exhaustion = detect_exhaustion(window, direction)
    impulsion = detect_impulsion(window, direction)
    continuity = detect_continuity(window, direction)
    opposite_weakness = detect_opposite_weakness(window, direction)

    active_patterns = active_pattern_names(patterns)
    dominant_pattern = active_patterns[0] if active_patterns else trigger_feature["pattern"]

    sequence_summary_parts: list[str] = [f"bias={sequence_bias}"]
    if exhaustion:
        sequence_summary_parts.append("exaustao")
    if impulsion:
        sequence_summary_parts.append("impulsao")
    if continuity:
        sequence_summary_parts.append("continuidade")
    if opposite_weakness:
        sequence_summary_parts.append("fraqueza_do_lado_oposto")
    if active_patterns:
        sequence_summary_parts.append(f"padrao={','.join(active_patterns)}")

    return {
        "window_size": len(window),
        "trigger_candle": trigger_feature,
        "prior_candles": prior_features,
        "sequence_bias": sequence_bias,
        "exhaustion_detected": exhaustion,
        "impulsion_detected": impulsion,
        "continuity_detected": continuity,
        "opposite_side_weakness": opposite_weakness,
        "patterns": patterns,
        "active_patterns": active_patterns,
        "dominant_pattern": dominant_pattern,
        "sequence_summary": " | ".join(sequence_summary_parts),
    }


def build_macro_context(
    direction: str,
    trend_alignment: str,
    price_vs_short_ema: str,
    price_vs_long_ema: str,
    price_vs_ema_200: str,
    short_ema_slope: str,
    long_ema_slope: str,
    ema_200_slope: str,
    cross_state: str,
    macd_state: str,
    market_structure: str,
    continuity_detected: bool,
    impulsion_detected: bool,
    exhaustion_detected: bool,
    entry_location: str | None = None,
) -> dict[str, Any]:
    macro_points = 0
    macro_signals: list[str] = []

    normalized_entry_location = normalize_entry_location(entry_location)
    normalized_cross_state = normalize_cross_state(cross_state)

    if direction == "buy":
        if normalized_cross_state == "bullish_cross":
            macro_points += 2
            macro_signals.append("cruzamento_bullish_confirmado")
        elif normalized_cross_state == "bullish_above":
            macro_points += 1
            macro_signals.append("curta_acima_longa")
        elif normalized_cross_state == "bearish_cross":
            macro_points -= 3
            macro_signals.append("cruzamento_contra")

        if short_ema_slope == "up":
            macro_points += 1
            macro_signals.append("m9_a_subir")
        else:
            macro_points -= 1
            macro_signals.append("m9_sem_alinhamento")

        if long_ema_slope == "up":
            macro_points += 1
            macro_signals.append("m21_a_subir")
        else:
            macro_points -= 1
            macro_signals.append("m21_sem_alinhamento")

        if trend_alignment == "bullish":
            macro_points += 1
            macro_signals.append("alinhamento_ema_bullish")

        if price_vs_short_ema == "above":
            macro_points += 1
            macro_signals.append("preco_acima_ema_curta")
        else:
            macro_points -= 1
            macro_signals.append("preco_nao_acima_ema_curta")

        if price_vs_long_ema == "above":
            macro_points += 2
            macro_signals.append("preco_acima_ema_longa")
        else:
            macro_points -= 2
            macro_signals.append("preco_nao_acima_ema_longa")

        if price_vs_ema_200 == "above":
            macro_points += 1
            macro_signals.append("preco_acima_ema200")
        else:
            macro_points -= 2
            macro_signals.append("ema200_contra")

        if ema_200_slope == "up":
            macro_points += 1
            macro_signals.append("ema200_a_subir")
        elif ema_200_slope == "down":
            macro_points -= 1
            macro_signals.append("ema200_a_descer")

        if macd_state in {"bullish_cross", "bullish_above_signal"}:
            macro_points += 1
            macro_signals.append("macd_comprador")

        if market_structure == "bullish":
            macro_points += 1
            macro_signals.append("estrutura_bullish")

    else:
        if normalized_cross_state == "bearish_cross":
            macro_points += 2
            macro_signals.append("cruzamento_bearish_confirmado")
        elif normalized_cross_state == "bearish_below":
            macro_points += 1
            macro_signals.append("curta_abaixo_longa")
        elif normalized_cross_state == "bullish_cross":
            macro_points -= 3
            macro_signals.append("cruzamento_contra")

        if short_ema_slope == "down":
            macro_points += 1
            macro_signals.append("m9_a_descer")
        else:
            macro_points -= 1
            macro_signals.append("m9_sem_alinhamento")

        if long_ema_slope == "down":
            macro_points += 1
            macro_signals.append("m21_a_descer")
        else:
            macro_points -= 1
            macro_signals.append("m21_sem_alinhamento")

        if trend_alignment == "bearish":
            macro_points += 1
            macro_signals.append("alinhamento_ema_bearish")

        if price_vs_short_ema == "below":
            macro_points += 1
            macro_signals.append("preco_abaixo_ema_curta")
        else:
            macro_points -= 1
            macro_signals.append("preco_nao_abaixo_ema_curta")

        if price_vs_long_ema == "below":
            macro_points += 2
            macro_signals.append("preco_abaixo_ema_longa")
        else:
            macro_points -= 2
            macro_signals.append("preco_nao_abaixo_ema_longa")

        if price_vs_ema_200 == "below":
            macro_points += 1
            macro_signals.append("preco_abaixo_ema200")
        else:
            macro_points -= 2
            macro_signals.append("ema200_contra")

        if ema_200_slope == "down":
            macro_points += 1
            macro_signals.append("ema200_a_descer")
        elif ema_200_slope == "up":
            macro_points -= 1
            macro_signals.append("ema200_a_subir")

        if macd_state in {"bearish_cross", "bearish_below_signal"}:
            macro_points += 1
            macro_signals.append("macd_vendedor")

        if market_structure == "bearish":
            macro_points += 1
            macro_signals.append("estrutura_bearish")

    if continuity_detected:
        macro_points += 2
        macro_signals.append("continuidade_detectada")

    if impulsion_detected:
        macro_points += 1
        macro_signals.append("impulsao_detectada")

    if exhaustion_detected:
        macro_points += 1
        macro_signals.append("exaustao_detectada")

    has_sequence_support = continuity_detected or impulsion_detected or exhaustion_detected

    if normalized_entry_location == "breakout" and market_structure == "range":
        macro_points -= 2
        macro_signals.append("contexto_range_para_breakout")

    if normalized_entry_location == "breakout" and not has_sequence_support:
        macro_points -= 3
        macro_signals.append("breakout_sem_sequencia")

    return {
        "macro_points": macro_points,
        "macro_signals": macro_signals,
        "macro_is_strong": macro_points >= 8,
        "macro_is_moderate": macro_points >= 6,
    }


def count_severe_blockers(reasons_against: list[str]) -> int:
    severe_tokens = {
        "ema200_contra",
        "adx_fraco",
        "adx_sem_forca",
        "macd_contra",
        "trigger_sem_forca",
        "trigger_contra_o_setup",
        "sem_sequencia_confirmada",
        "padrao_de_rejeicao",
        "breakout_em_range",
        "breakout_sem_sequencia",
        "cruzamento_contra",
    }
    return sum(1 for token in reasons_against if token in severe_tokens)


def derive_score_cap(
    entry_location: str,
    reasons_against: list[str],
    hard_blockers: int,
) -> int:
    if not reasons_against:
        return 10

    severe_blockers = count_severe_blockers(reasons_against)
    score_cap = 9

    if "ema200_contra" in reasons_against:
        score_cap = min(score_cap, 8)

    if severe_blockers >= 1:
        score_cap = min(score_cap, 8)

    if hard_blockers >= 2 or severe_blockers >= 2:
        score_cap = min(score_cap, 6 if entry_location == "breakout" else 7)

    if hard_blockers >= 3 or severe_blockers >= 3:
        score_cap = min(score_cap, 4 if entry_location == "breakout" else 5)

    return score_cap


def derive_decision_from_score(
    final_score: int,
    hard_blockers: int,
) -> tuple[str, str, str]:
    if final_score >= 8 and hard_blockers == 0:
        return ("forte", "validar_entrada", "immediate")

    if final_score >= 6 and hard_blockers <= 1:
        return ("boa", "aceitar_com_confirmacao", "confirm_next_candle")

    if final_score >= 4:
        return ("neutra", "ter_cautela", "pullback_confirmation")

    return ("fraca", "evitar_entrada", "reject")


def score_confirmation(
    setup_direction: str,
    force_reading: dict[str, Any],
    trend_alignment: str,
    price_vs_short_ema: str,
    price_vs_long_ema: str,
    price_vs_ema_200: str,
    short_ema_slope: str,
    long_ema_slope: str,
    ema_200_slope: str,
    cross_state: str,
    macd_state: str,
    rsi_slope: str,
    market_structure: str,
    adx_value: Decimal | None,
    entry_location: str | None = None,
) -> dict[str, Any]:
    direction = normalize_direction(setup_direction)
    normalized_entry_location = normalize_entry_location(entry_location)
    normalized_cross_state = normalize_cross_state(cross_state)

    score = 0
    reasons_for: list[str] = []
    reasons_against: list[str] = []

    trigger_pattern = str(force_reading.get("trigger_candle", {}).get("pattern", "")).strip()
    trigger_strength_class = str(
        force_reading.get("trigger_candle", {}).get("strength_class", "")
    ).strip()
    trigger_body_ratio_raw = force_reading.get("trigger_candle", {}).get("body_ratio")
    trigger_body_ratio = Decimal(str(trigger_body_ratio_raw or "0"))
    active_patterns = force_reading.get("active_patterns", [])
    dominant_pattern = str(force_reading.get("dominant_pattern") or "").strip()
    exhaustion_detected = bool(force_reading.get("exhaustion_detected"))
    impulsion_detected = bool(force_reading.get("impulsion_detected"))
    continuity_detected = bool(force_reading.get("continuity_detected"))
    opposite_side_weakness = bool(force_reading.get("opposite_side_weakness"))

    bullish_patterns = {
        "bullish_engulfing",
        "piercing_line",
        "morning_star",
        "three_inside_up",
        "three_outside_up",
        "three_white_soldiers",
        "bullish_harami",
    }
    bearish_patterns = {
        "bearish_engulfing",
        "dark_cloud_cover",
        "evening_star",
        "three_inside_down",
        "three_outside_down",
        "three_black_crows",
        "bearish_harami",
    }
    weak_patterns = {
        "bullish_harami",
        "bearish_harami",
    }

    hard_rejection_buy = {
        "shooting_star",
        "gravestone_doji",
        "evening_star",
        "bearish_engulfing",
        "dark_cloud_cover",
    }
    hard_rejection_sell = {
        "hammer",
        "dragonfly_doji",
        "morning_star",
        "bullish_engulfing",
        "piercing_line",
    }

    has_sequence_support = continuity_detected or impulsion_detected or exhaustion_detected

    macro_context = build_macro_context(
        direction=direction,
        trend_alignment=trend_alignment,
        price_vs_short_ema=price_vs_short_ema,
        price_vs_long_ema=price_vs_long_ema,
        price_vs_ema_200=price_vs_ema_200,
        short_ema_slope=short_ema_slope,
        long_ema_slope=long_ema_slope,
        ema_200_slope=ema_200_slope,
        cross_state=normalized_cross_state,
        macd_state=macd_state,
        market_structure=market_structure,
        continuity_detected=continuity_detected,
        impulsion_detected=impulsion_detected,
        exhaustion_detected=exhaustion_detected,
        entry_location=normalized_entry_location,
    )

    macro_points = int(macro_context["macro_points"])
    macro_is_strong = bool(macro_context["macro_is_strong"])
    macro_is_moderate = bool(macro_context["macro_is_moderate"])

    score += macro_points

    negative_macro_signals = {
        "cruzamento_contra",
        "m9_sem_alinhamento",
        "m21_sem_alinhamento",
        "preco_nao_acima_ema_curta",
        "preco_nao_acima_ema_longa",
        "preco_nao_abaixo_ema_curta",
        "preco_nao_abaixo_ema_longa",
        "ema200_contra",
        "contexto_range_para_breakout",
        "breakout_sem_sequencia",
    }

    for macro_signal in macro_context["macro_signals"]:
        if macro_signal in negative_macro_signals:
            if macro_signal not in reasons_against:
                reasons_against.append(macro_signal)
        else:
            if macro_signal not in reasons_for:
                reasons_for.append(macro_signal)

    if direction == "buy":
        if macd_state not in {"bullish_cross", "bullish_above_signal"}:
            if macd_state in {"bearish_cross", "bearish_below_signal"}:
                score -= 2
                if "macd_contra" not in reasons_against:
                    reasons_against.append("macd_contra")

        if rsi_slope == "up":
            score += 1
            if "rsi_a_subir" not in reasons_for:
                reasons_for.append("rsi_a_subir")
        elif rsi_slope == "down":
            score -= 1
            if "rsi_a_descer" not in reasons_against:
                reasons_against.append("rsi_a_descer")

        if trigger_pattern in {"hammer", "bullish_impulse", "bullish_marubozu", "dragonfly_doji"}:
            score += 2
            token = f"trigger_pattern={trigger_pattern}"
            if token not in reasons_for:
                reasons_for.append(token)
        elif trigger_strength_class in {"bearish_force", "bearish"}:
            penalty = 5 if normalized_entry_location == "breakout" else 4
            score -= penalty
            if "trigger_contra_o_setup" not in reasons_against:
                reasons_against.append("trigger_contra_o_setup")
        elif trigger_body_ratio < DECIMAL_POINT_40:
            penalty = 4 if normalized_entry_location == "breakout" else 3
            score -= penalty
            if "trigger_sem_forca" not in reasons_against:
                reasons_against.append("trigger_sem_forca")

        if dominant_pattern in hard_rejection_buy:
            score -= 4
            if "padrao_de_rejeicao" not in reasons_against:
                reasons_against.append("padrao_de_rejeicao")

    else:
        if macd_state not in {"bearish_cross", "bearish_below_signal"}:
            if macd_state in {"bullish_cross", "bullish_above_signal"}:
                score -= 2
                if "macd_contra" not in reasons_against:
                    reasons_against.append("macd_contra")

        if rsi_slope == "down":
            score += 1
            if "rsi_a_descer" not in reasons_for:
                reasons_for.append("rsi_a_descer")
        elif rsi_slope == "up":
            score -= 1
            if "rsi_a_subir" not in reasons_against:
                reasons_against.append("rsi_a_subir")

        if trigger_pattern in {
            "shooting_star",
            "bearish_impulse",
            "bearish_marubozu",
            "gravestone_doji",
        }:
            score += 2
            token = f"trigger_pattern={trigger_pattern}"
            if token not in reasons_for:
                reasons_for.append(token)
        elif trigger_strength_class in {"bullish_force", "bullish"}:
            penalty = 5 if normalized_entry_location == "breakout" else 4
            score -= penalty
            if "trigger_contra_o_setup" not in reasons_against:
                reasons_against.append("trigger_contra_o_setup")
        elif trigger_body_ratio < DECIMAL_POINT_40:
            penalty = 4 if normalized_entry_location == "breakout" else 3
            score -= penalty
            if "trigger_sem_forca" not in reasons_against:
                reasons_against.append("trigger_sem_forca")

        if dominant_pattern in hard_rejection_sell:
            score -= 4
            if "padrao_de_rejeicao" not in reasons_against:
                reasons_against.append("padrao_de_rejeicao")

    if adx_value is not None:
        if adx_value >= Decimal("25"):
            score += 1
            if "adx_forte" not in reasons_for:
                reasons_for.append("adx_forte")
        elif adx_value < Decimal("12"):
            penalty = 3 if normalized_entry_location == "breakout" else 2
            score -= penalty
            if "adx_fraco" not in reasons_against:
                reasons_against.append("adx_fraco")
        elif adx_value < Decimal("20"):
            penalty = 2 if normalized_entry_location == "breakout" else 1
            score -= penalty
            if "adx_sem_forca" not in reasons_against:
                reasons_against.append("adx_sem_forca")

    for pattern_name in active_patterns:
        pattern_weight = 1 if pattern_name in weak_patterns else 2

        if direction == "buy" and pattern_name in bullish_patterns:
            score += pattern_weight
            token = f"padrao_favoravel={pattern_name}"
            if token not in reasons_for:
                reasons_for.append(token)
        elif direction == "sell" and pattern_name in bearish_patterns:
            score += pattern_weight
            token = f"padrao_favoravel={pattern_name}"
            if token not in reasons_for:
                reasons_for.append(token)
        elif pattern_name in bullish_patterns or pattern_name in bearish_patterns:
            penalty = 4 if pattern_name not in weak_patterns else 2
            score -= penalty
            token = f"padrao_contrario={pattern_name}"
            if token not in reasons_against:
                reasons_against.append(token)

    if exhaustion_detected:
        score += 1
        if "exaustao_detectada" not in reasons_for:
            reasons_for.append("exaustao_detectada")

    if impulsion_detected:
        score += 2
        if "impulsao_detectada" not in reasons_for:
            reasons_for.append("impulsao_detectada")

    if continuity_detected:
        score += 2
        if "continuidade_detectada" not in reasons_for:
            reasons_for.append("continuidade_detectada")

    if opposite_side_weakness:
        score += 1
        if "fraqueza_do_lado_oposto" not in reasons_for:
            reasons_for.append("fraqueza_do_lado_oposto")

    if not has_sequence_support:
        penalty = 4 if normalized_entry_location == "breakout" else 3
        score -= penalty
        if "sem_sequencia_confirmada" not in reasons_against:
            reasons_against.append("sem_sequencia_confirmada")

    if market_structure == "range":
        if normalized_entry_location == "breakout":
            score -= 3
            if "breakout_em_range" not in reasons_against:
                reasons_against.append("breakout_em_range")
        elif normalized_entry_location == "pullback":
            score -= 1
            if "pullback_em_range" not in reasons_against:
                reasons_against.append("pullback_em_range")

    hard_blockers = 0

    if "ema200_contra" in reasons_against:
        hard_blockers += 1

    if "trigger_sem_forca" in reasons_against:
        hard_blockers += 1

    if "sem_sequencia_confirmada" in reasons_against:
        hard_blockers += 1

    if "padrao_de_rejeicao" in reasons_against:
        hard_blockers += 1

    if "adx_sem_forca" in reasons_against or "adx_fraco" in reasons_against:
        hard_blockers += 1

    if "macd_contra" in reasons_against:
        hard_blockers += 1

    score_cap = derive_score_cap(
        entry_location=normalized_entry_location,
        reasons_against=reasons_against,
        hard_blockers=hard_blockers,
    )

    final_score = clamp(score, 0, 10)
    final_score = min(final_score, score_cap)

    label, action, entry_mode = derive_decision_from_score(final_score, hard_blockers)

    return {
        "setup_direction": direction,
        "entry_location": normalized_entry_location,
        "cross_state": normalized_cross_state,
        "macro_points": macro_points,
        "macro_is_strong": macro_is_strong,
        "macro_is_moderate": macro_is_moderate,
        "hard_blockers": hard_blockers,
        "score_cap": score_cap,
        "score": final_score,
        "score_label": label,
        "recommended_action": action,
        "entry_mode": entry_mode,
        "reasons_for": reasons_for,
        "reasons_against": reasons_against,
    }


def build_candlestick_intelligence(
    candles: list[Candle],
    index: int,
    setup_direction: str,
    trend_alignment: str,
    price_vs_ema_20: str,
    price_vs_ema_40: str,
    macd_state: str,
    rsi_slope: str,
    market_structure: str,
    adx_value: Decimal | None,
    lookback: int = 5,
    entry_location: str | None = None,
    cross_state: str | None = None,
    price_vs_ema_200: str | None = None,
    short_ema_slope: str | None = None,
    long_ema_slope: str | None = None,
    ema_200_slope: str | None = None,
) -> dict[str, Any]:
    start_index = max(0, index - lookback + 1)
    window = candles[start_index : index + 1]

    if not window:
        return {
            "phase_1_candle_features": {},
            "phase_2_sequence_patterns": {},
            "phase_3_confirmation": {},
        }

    normalized_direction = normalize_direction(setup_direction)
    normalized_entry_location = normalize_entry_location(entry_location)
    normalized_cross_state = normalize_cross_state(cross_state)

    force_reading = build_force_reading(window, normalized_direction)
    confirmation = score_confirmation(
        setup_direction=normalized_direction,
        force_reading=force_reading,
        trend_alignment=trend_alignment,
        price_vs_short_ema=price_vs_ema_20,
        price_vs_long_ema=price_vs_ema_40,
        price_vs_ema_200=str(price_vs_ema_200 or "unknown"),
        short_ema_slope=str(short_ema_slope or "unknown"),
        long_ema_slope=str(long_ema_slope or "unknown"),
        ema_200_slope=str(ema_200_slope or "unknown"),
        cross_state=normalized_cross_state,
        macd_state=macd_state,
        rsi_slope=rsi_slope,
        market_structure=market_structure,
        adx_value=adx_value,
        entry_location=normalized_entry_location,
    )

    trigger_candle = force_reading.get("trigger_candle", {})
    prior_candles = force_reading.get("prior_candles", [])

    phase_1 = {
        "objective": "classificar o candle de validação e os candles imediatamente anteriores",
        "setup_direction": normalized_direction,
        "entry_location": normalized_entry_location,
        "cross_state": normalized_cross_state,
        "trigger_pattern": trigger_candle.get("pattern"),
        "trigger_strength_class": trigger_candle.get("strength_class"),
        "trigger_close_position": trigger_candle.get("close_position"),
        "trigger_body_ratio": trigger_candle.get("body_ratio"),
        "trigger_upper_wick_ratio": trigger_candle.get("upper_wick_ratio"),
        "trigger_lower_wick_ratio": trigger_candle.get("lower_wick_ratio"),
        "candles": [*prior_candles, trigger_candle],
    }

    phase_2 = {
        "objective": "ler sequência anterior ao cruzamento: exaustão, impulsão, continuidade e padrão clássico",
        "setup_direction": normalized_direction,
        "entry_location": normalized_entry_location,
        "cross_state": normalized_cross_state,
        "window_size": force_reading.get("window_size"),
        "sequence_bias": force_reading.get("sequence_bias"),
        "exhaustion_detected": force_reading.get("exhaustion_detected"),
        "impulsion_detected": force_reading.get("impulsion_detected"),
        "continuity_detected": force_reading.get("continuity_detected"),
        "opposite_side_weakness": force_reading.get("opposite_side_weakness"),
        "dominant_pattern": force_reading.get("dominant_pattern"),
        "active_patterns": force_reading.get("active_patterns"),
        "sequence_summary": force_reading.get("sequence_summary"),
    }

    phase_3 = {
        "objective": "gerar score final de confirmação do cruzamento",
        "setup_direction": confirmation.get("setup_direction"),
        "entry_location": confirmation.get("entry_location"),
        "cross_state": confirmation.get("cross_state"),
        "macro_points": confirmation.get("macro_points"),
        "macro_is_strong": confirmation.get("macro_is_strong"),
        "macro_is_moderate": confirmation.get("macro_is_moderate"),
        "hard_blockers": confirmation.get("hard_blockers"),
        "score_cap": confirmation.get("score_cap"),
        "confirmation_score": confirmation.get("score"),
        "confirmation_label": confirmation.get("score_label"),
        "recommended_action": confirmation.get("recommended_action"),
        "entry_mode": confirmation.get("entry_mode"),
        "reasons_for": confirmation.get("reasons_for"),
        "reasons_against": confirmation.get("reasons_against"),
    }

    return {
        "phase_1_candle_features": phase_1,
        "phase_2_sequence_patterns": phase_2,
        "phase_3_confirmation": phase_3,
    }