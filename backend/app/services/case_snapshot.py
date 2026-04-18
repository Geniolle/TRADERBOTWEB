# C:\Trader-bot\app\services\case_snapshot.py

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP, localcontext

from app.indicators.atr import average_true_range_series
from app.indicators.bollinger import bollinger_bands
from app.indicators.ema import exponential_moving_average_series
from app.indicators.macd import macd_series
from app.indicators.rsi import relative_strength_index_series
from app.models.domain.candle import Candle
from app.models.domain.strategy_config import StrategyConfig
from app.services.candlestick_intelligence import build_candlestick_intelligence


BASE_EMA_PERIODS = [5, 10, 20, 30, 40]


def build_case_metadata_snapshot(
    candles: list[Candle],
    index: int,
    config: StrategyConfig,
) -> dict:
    if index < 0 or index >= len(candles):
        raise IndexError("index out of range for candles snapshot")

    current_candle = candles[index]
    current_slice = candles[: index + 1]
    previous_slice = candles[:index]

    closes = [candle.close for candle in current_slice]

    short_period = int(config.parameters.get("ema_short_period", 9))
    long_period = int(config.parameters.get("ema_long_period", 21))
    tracked_periods = sorted(set([*BASE_EMA_PERIODS, short_period, long_period, 200]))

    ema_values: dict[int, Decimal | None] = {}
    ema_previous_values: dict[int, Decimal | None] = {}

    for period in tracked_periods:
        current_series = exponential_moving_average_series(closes, period)
        ema_values[period] = current_series[-1] if current_series else None
        ema_previous_values[period] = current_series[-2] if len(current_series) >= 2 else None

    bollinger_period = int(config.parameters.get("bollinger_period", 20))
    bollinger_stddev = Decimal(str(config.parameters.get("bollinger_stddev", 2)))

    current_bands = bollinger_bands(closes, bollinger_period, bollinger_stddev)
    previous_bands = None
    if previous_slice:
        previous_bands = bollinger_bands(
            [candle.close for candle in previous_slice],
            bollinger_period,
            bollinger_stddev,
        )

    rsi_period = int(config.parameters.get("rsi_period", 14))
    rsi_series = relative_strength_index_series(closes, rsi_period)
    current_rsi = rsi_series[-1] if rsi_series else None
    previous_rsi = rsi_series[-2] if len(rsi_series) >= 2 else None

    macd_values = macd_series(closes, fast_period=12, slow_period=26, signal_period=9)
    current_macd = (
        macd_values[-1]
        if macd_values
        else {"macd_line": None, "signal_line": None, "histogram": None}
    )
    previous_macd = (
        macd_values[-2]
        if len(macd_values) >= 2
        else {"macd_line": None, "signal_line": None, "histogram": None}
    )

    atr_period = int(config.parameters.get("atr_period", 14))
    atr_series = average_true_range_series(current_slice, atr_period)
    current_atr = atr_series[-1] if atr_series else None

    adx_period = int(config.parameters.get("adx_period", 14))
    adx_series = average_directional_index_series(current_slice, adx_period)
    current_adx = adx_series[-1] if adx_series else None
    previous_adx = adx_series[-2] if len(adx_series) >= 2 else None

    lower_band = middle_band = upper_band = None
    previous_lower = previous_middle = previous_upper = None

    if current_bands is not None:
        lower_band, middle_band, upper_band = current_bands

    if previous_bands is not None:
        previous_lower, previous_middle, previous_upper = previous_bands

    previous_candle = candles[index - 1] if index > 0 else None

    ema_alignment = classify_ema_alignment(ema_values)
    market_structure = classify_market_structure(current_slice)
    candle_stats = build_candle_stats(current_candle)
    session = classify_session(current_candle.open_time.hour)
    rsi_zone = classify_rsi_zone(current_rsi)
    macd_state = classify_macd_state(current_macd, previous_macd)
    atr_regime = classify_atr_regime(current_slice, current_atr, atr_period)

    short_ema_value = ema_values.get(short_period)
    short_ema_previous = ema_previous_values.get(short_period)
    long_ema_value = ema_values.get(long_period)
    long_ema_previous = ema_previous_values.get(long_period)
    ema_200_value = ema_values.get(200)
    ema_200_previous = ema_previous_values.get(200)

    price_vs_short_ema = classify_price_vs_average(current_candle.close, short_ema_value)
    price_vs_long_ema = classify_price_vs_average(current_candle.close, long_ema_value)
    price_vs_ema_20 = classify_price_vs_average(current_candle.close, ema_values.get(20))
    price_vs_ema_40 = classify_price_vs_average(current_candle.close, ema_values.get(40))
    price_vs_ema_200 = classify_price_vs_average(current_candle.close, ema_200_value)

    short_ema_slope = slope_label(short_ema_value, short_ema_previous)
    long_ema_slope = slope_label(long_ema_value, long_ema_previous)
    ema_200_slope = slope_label(ema_200_value, ema_200_previous)
    adx_slope = slope_label(current_adx, previous_adx)

    cross_state = classify_cross_state(
        current_short=short_ema_value,
        previous_short=short_ema_previous,
        current_long=long_ema_value,
        previous_long=long_ema_previous,
    )

    vwap_value = calculate_vwap(current_slice)
    price_vs_vwap = classify_price_vs_average(current_candle.close, vwap_value)
    vwap_state = price_vs_vwap

    volume_window = current_slice[-20:]
    volume_ratio = calculate_volume_ratio(volume_window)
    volume_zscore = calculate_volume_zscore(volume_window)
    volume_signal = classify_volume_signal(volume_ratio)
    volume_context = classify_volume_context(volume_ratio)

    trend_confirmed_long = (
        short_ema_value is not None
        and long_ema_value is not None
        and short_ema_value > long_ema_value
        and short_ema_slope == "up"
        and long_ema_slope == "up"
        and price_vs_short_ema in {"above", "touching"}
        and price_vs_long_ema == "above"
    )

    trend_confirmed_short = (
        short_ema_value is not None
        and long_ema_value is not None
        and short_ema_value < long_ema_value
        and short_ema_slope == "down"
        and long_ema_slope == "down"
        and price_vs_short_ema in {"below", "touching"}
        and price_vs_long_ema == "below"
    )

    closed_below_lower_band = bool(lower_band is not None and current_candle.close < lower_band)
    closed_above_upper_band = bool(upper_band is not None and current_candle.close > upper_band)

    reentered_inside_band_long = bool(
        previous_candle is not None
        and previous_lower is not None
        and lower_band is not None
        and previous_candle.close < previous_lower
        and current_candle.close > lower_band
    )

    reentered_inside_band_short = bool(
        previous_candle is not None
        and previous_upper is not None
        and upper_band is not None
        and previous_candle.close > previous_upper
        and current_candle.close < upper_band
    )

    candle_range = current_candle.high - current_candle.low
    candle_range_vs_atr = None
    if current_atr is not None and current_atr > 0:
        candle_range_vs_atr = candle_range / current_atr

    bollinger_z_score = calculate_bollinger_z_score(
        close=current_candle.close,
        middle_band=middle_band,
        upper_band=upper_band,
        stddev_multiplier=bollinger_stddev,
    )

    distance_outside_band = calculate_distance_outside_band(
        close=current_candle.close,
        lower_band=lower_band,
        upper_band=upper_band,
        middle_band=middle_band,
        stddev_multiplier=bollinger_stddev,
    )

    distance_from_band = calculate_distance_from_nearest_band(
        close=current_candle.close,
        lower_band=lower_band,
        upper_band=upper_band,
        middle_band=middle_band,
        stddev_multiplier=bollinger_stddev,
    )

    band_distance_ratio = distance_outside_band

    setup_direction = resolve_setup_direction(
        config=config,
        cross_state=cross_state,
        short_ema=short_ema_value,
        long_ema=long_ema_value,
        ema_alignment=ema_alignment,
    )

    entry_location = classify_entry_location(
        market_structure=market_structure,
        close=current_candle.close,
        short_ema=short_ema_value,
        long_ema=long_ema_value,
        lower_band=lower_band,
        upper_band=upper_band,
        cross_state=cross_state,
    )

    candlestick_intelligence = build_candlestick_intelligence(
        candles=candles,
        index=index,
        setup_direction=setup_direction,
        trend_alignment=ema_alignment,
        price_vs_ema_20=price_vs_short_ema,
        price_vs_ema_40=price_vs_long_ema,
        macd_state=macd_state,
        rsi_slope=slope_label(current_rsi, previous_rsi),
        market_structure=market_structure,
        adx_value=current_adx,
        entry_location=entry_location,
        lookback=5,
        cross_state=cross_state,
        price_vs_ema_200=price_vs_ema_200,
        short_ema_slope=short_ema_slope,
        long_ema_slope=long_ema_slope,
        ema_200_slope=ema_200_slope,
    )

    snapshot = {
        "snapshot_version": "2.0",
        "trigger_context": {
            "reference_time": current_candle.close_time.isoformat(),
            "reference_price": as_str(current_candle.close),
            "session": session,
            "day_of_week": current_candle.open_time.strftime("%A").lower(),
            "hour_of_day": current_candle.open_time.hour,
            "setup_direction": setup_direction,
            "cross_state": cross_state,
        },
        "trend": {
            "ema_5": as_str(ema_values.get(5)),
            "ema_9": as_str(short_ema_value) if short_period == 9 else None,
            "ema_10": as_str(ema_values.get(10)),
            "ema_20": as_str(ema_values.get(20)),
            "ema_21": as_str(long_ema_value) if long_period == 21 else None,
            "ema_30": as_str(ema_values.get(30)),
            "ema_40": as_str(ema_values.get(40)),
            "ema_200": as_str(ema_200_value),
            "short_ema_period": short_period,
            "long_ema_period": long_period,
            "short_ema": as_str(short_ema_value),
            "long_ema": as_str(long_ema_value),
            "ema_alignment": ema_alignment,
            "cross_state": cross_state,
            "price_vs_short_ema": price_vs_short_ema,
            "price_vs_long_ema": price_vs_long_ema,
            "price_vs_ema_20": price_vs_ema_20,
            "price_vs_ema_40": price_vs_ema_40,
            "price_vs_ema_200": price_vs_ema_200,
            "price_vs_vwap": price_vs_vwap,
            "vwap_state": vwap_state,
            "adx": as_str(current_adx),
            "adx_14": as_str(current_adx),
            "ema_5_slope": slope_label(ema_values.get(5), ema_previous_values.get(5)),
            "ema_9_slope": short_ema_slope if short_period == 9 else "unknown",
            "ema_10_slope": slope_label(ema_values.get(10), ema_previous_values.get(10)),
            "ema_20_slope": slope_label(ema_values.get(20), ema_previous_values.get(20)),
            "ema_21_slope": long_ema_slope if long_period == 21 else "unknown",
            "ema_30_slope": slope_label(ema_values.get(30), ema_previous_values.get(30)),
            "ema_40_slope": slope_label(ema_values.get(40), ema_previous_values.get(40)),
            "ema_200_slope": ema_200_slope,
            "short_ema_slope": short_ema_slope,
            "long_ema_slope": long_ema_slope,
            "adx_slope": adx_slope,
        },
        "bollinger": {
            "period": bollinger_period,
            "stddev": as_str(bollinger_stddev),
            "upper": as_str(upper_band),
            "middle": as_str(middle_band),
            "lower": as_str(lower_band),
            "bandwidth": as_str(
                (upper_band - lower_band)
                if upper_band is not None and lower_band is not None
                else None
            ),
            "close_position_in_band": as_str(
                calculate_band_position(current_candle.close, lower_band, upper_band)
            ),
            "z_score": as_str(bollinger_z_score),
            "zscore": as_str(bollinger_z_score),
            "distance_from_band": as_str(distance_from_band),
            "distance_outside_band": as_str(distance_outside_band),
            "band_distance_ratio": as_str(band_distance_ratio),
            "closed_below_lower_band": closed_below_lower_band,
            "closed_above_upper_band": closed_above_upper_band,
            "reentered_inside_band_long": reentered_inside_band_long,
            "reentered_inside_band_short": reentered_inside_band_short,
        },
        "momentum": {
            "rsi_14": as_str(current_rsi),
            "rsi_zone": rsi_zone,
            "rsi_slope": slope_label(current_rsi, previous_rsi),
            "macd_line": as_str(current_macd.get("macd_line")),
            "macd_signal": as_str(current_macd.get("signal_line")),
            "macd_histogram": as_str(current_macd.get("histogram")),
            "macd_state": macd_state,
            "macd_histogram_slope": slope_label(
                current_macd.get("histogram"),
                previous_macd.get("histogram"),
            ),
            "volume_signal": volume_signal,
            "volume_ratio": as_str(volume_ratio),
        },
        "volatility": {
            "atr_14": as_str(current_atr),
            "atr_regime": atr_regime,
            "candle_range": as_str(candle_range),
            "candle_range_vs_atr": as_str(candle_range_vs_atr),
        },
        "structure": {
            "market_structure": market_structure,
            "entry_location": entry_location,
            "distance_to_recent_support": as_str(distance_to_recent_support(current_slice)),
            "distance_to_recent_resistance": as_str(distance_to_recent_resistance(current_slice)),
            "distance_to_short_ema": as_str(distance_to_level(current_candle.close, short_ema_value)),
            "distance_to_long_ema": as_str(distance_to_level(current_candle.close, long_ema_value)),
            "distance_to_ema_20": as_str(distance_to_level(current_candle.close, ema_values.get(20))),
            "distance_to_ema_40": as_str(distance_to_level(current_candle.close, ema_values.get(40))),
            "distance_to_ema_200": as_str(distance_to_level(current_candle.close, ema_200_value)),
            "price_vs_vwap": price_vs_vwap,
            "adx": as_str(current_adx),
            "adx_14": as_str(current_adx),
        },
        "trigger_candle": candle_stats,
        "patterns": {
            "cross_up_confirmed": cross_state == "bullish_cross",
            "cross_down_confirmed": cross_state == "bearish_cross",
            "ema_trend_confirmed_long": trend_confirmed_long,
            "ema_trend_confirmed_short": trend_confirmed_short,
            "price_above_short_ema": price_vs_short_ema == "above",
            "price_below_short_ema": price_vs_short_ema == "below",
            "price_above_long_ema": price_vs_long_ema == "above",
            "price_below_long_ema": price_vs_long_ema == "below",
            "price_above_ema_200": price_vs_ema_200 == "above",
            "price_below_ema_200": price_vs_ema_200 == "below",
            "rsi_recovery_long": bool(
                previous_rsi is not None
                and current_rsi is not None
                and previous_rsi <= Decimal("30")
                and current_rsi > previous_rsi
            ),
            "rsi_recovery_short": bool(
                previous_rsi is not None
                and current_rsi is not None
                and previous_rsi >= Decimal("70")
                and current_rsi < previous_rsi
            ),
            "macd_confirmation_long": macd_state in {"bullish_cross", "bullish_above_signal"},
            "macd_confirmation_short": macd_state in {"bearish_cross", "bearish_below_signal"},
            "bb_reentry_long": reentered_inside_band_long,
            "bb_reentry_short": reentered_inside_band_short,
            "countertrend_long": not trend_confirmed_long,
            "countertrend_short": not trend_confirmed_short,
        },
        "volume": {
            "signal": volume_signal,
            "context": volume_context,
            "relative_state": volume_signal,
            "relative_volume": as_str(volume_ratio),
            "ratio": as_str(volume_ratio),
            "zscore": as_str(volume_zscore),
        },
        "vwap": {
            "value": as_str(vwap_value),
            "state": vwap_state,
            "signal": vwap_state,
        },
        "candlestick_intelligence": candlestick_intelligence,
    }

    return snapshot


def as_str(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value.normalize(), "f")


def resolve_setup_direction(
    config: StrategyConfig,
    cross_state: str,
    short_ema: Decimal | None,
    long_ema: Decimal | None,
    ema_alignment: str,
) -> str:
    candidates = [
        getattr(config, "direction", None),
        getattr(config, "trade_bias", None),
        getattr(config, "side", None),
    ]

    for candidate in candidates:
        normalized = str(candidate or "").strip().lower()
        if normalized in {"buy", "long", "bullish", "compradora"}:
            return "buy"
        if normalized in {"sell", "short", "bearish", "vendedora"}:
            return "sell"

    if cross_state == "bullish_cross":
        return "buy"

    if cross_state == "bearish_cross":
        return "sell"

    if short_ema is not None and long_ema is not None:
        return "buy" if short_ema >= long_ema else "sell"

    if ema_alignment == "bearish":
        return "sell"

    return "buy"


def classify_cross_state(
    current_short: Decimal | None,
    previous_short: Decimal | None,
    current_long: Decimal | None,
    previous_long: Decimal | None,
) -> str:
    if (
        current_short is None
        or previous_short is None
        or current_long is None
        or previous_long is None
    ):
        return "unknown"

    if previous_short <= previous_long and current_short > current_long:
        return "bullish_cross"

    if previous_short >= previous_long and current_short < current_long:
        return "bearish_cross"

    if current_short > current_long:
        return "bullish_above"

    if current_short < current_long:
        return "bearish_below"

    return "flat"


def slope_label(current: Decimal | None, previous: Decimal | None) -> str:
    if current is None or previous is None:
        return "unknown"
    if current > previous:
        return "up"
    if current < previous:
        return "down"
    return "flat"


def classify_ema_alignment(ema_values: dict[int, Decimal | None]) -> str:
    ema5 = ema_values.get(5)
    ema10 = ema_values.get(10)
    ema20 = ema_values.get(20)
    ema30 = ema_values.get(30)
    ema40 = ema_values.get(40)

    if None in {ema5, ema10, ema20, ema30, ema40}:
        return "unknown"

    if ema5 > ema10 > ema20 > ema30 > ema40:
        return "bullish"

    if ema5 < ema10 < ema20 < ema30 < ema40:
        return "bearish"

    return "mixed"


def classify_price_vs_average(price: Decimal, average: Decimal | None) -> str:
    if average is None:
        return "unknown"
    if price > average:
        return "above"
    if price < average:
        return "below"
    return "touching"


def classify_rsi_zone(rsi_value: Decimal | None) -> str:
    if rsi_value is None:
        return "unknown"
    if rsi_value <= Decimal("30"):
        return "oversold"
    if rsi_value < Decimal("40"):
        return "oversold_exit"
    if rsi_value >= Decimal("70"):
        return "overbought"
    if rsi_value > Decimal("60"):
        return "overbought_exit"
    return "neutral"


def classify_macd_state(
    current_macd: dict[str, Decimal | None],
    previous_macd: dict[str, Decimal | None],
) -> str:
    current_line = current_macd.get("macd_line")
    current_signal = current_macd.get("signal_line")
    previous_line = previous_macd.get("macd_line")
    previous_signal = previous_macd.get("signal_line")

    if (
        current_line is None
        or current_signal is None
        or previous_line is None
        or previous_signal is None
    ):
        return "unknown"

    if previous_line <= previous_signal and current_line > current_signal:
        return "bullish_cross"

    if previous_line >= previous_signal and current_line < current_signal:
        return "bearish_cross"

    if current_line > current_signal:
        return "bullish_above_signal"

    if current_line < current_signal:
        return "bearish_below_signal"

    return "neutral"


def calculate_band_position(
    close: Decimal,
    lower_band: Decimal | None,
    upper_band: Decimal | None,
) -> Decimal | None:
    if lower_band is None or upper_band is None:
        return None

    width = upper_band - lower_band
    if width == 0:
        return Decimal("0.5")

    return (close - lower_band) / width


def classify_session(hour: int) -> str:
    if 0 <= hour < 7:
        return "asia"
    if 7 <= hour < 12:
        return "london"
    if 12 <= hour < 17:
        return "new_york"
    if 17 <= hour < 21:
        return "us_late"
    return "off_hours"


def build_candle_stats(candle: Candle) -> dict:
    body = abs(candle.close - candle.open)
    c_range = candle.high - candle.low

    upper = candle.high - max(candle.open, candle.close)
    lower = min(candle.open, candle.close) - candle.low

    body_ratio = None
    if c_range > 0:
        body_ratio = body / c_range

    candle_type = classify_candle_type(
        open_price=candle.open,
        close_price=candle.close,
        body=body,
        upper_wick=upper,
        lower_wick=lower,
        candle_range=c_range,
    )

    return {
        "open": as_str(candle.open),
        "high": as_str(candle.high),
        "low": as_str(candle.low),
        "close": as_str(candle.close),
        "body_size": as_str(body),
        "upper_wick": as_str(upper),
        "lower_wick": as_str(lower),
        "body_ratio": as_str(body_ratio),
        "candle_type": candle_type,
    }


def classify_candle_type(
    open_price: Decimal,
    close_price: Decimal,
    body: Decimal,
    upper_wick: Decimal,
    lower_wick: Decimal,
    candle_range: Decimal,
) -> str:
    if candle_range == 0:
        return "flat"

    ratio = body / candle_range

    if ratio <= Decimal("0.15"):
        return "doji"

    if lower_wick > body * Decimal("1.5") and close_price > open_price:
        return "rejection"

    if upper_wick > body * Decimal("1.5") and close_price < open_price:
        return "rejection"

    if close_price > open_price and ratio >= Decimal("0.6"):
        return "bullish_impulse"

    if close_price < open_price and ratio >= Decimal("0.6"):
        return "bearish_impulse"

    return "balanced"


def classify_market_structure(candles: list[Candle]) -> str:
    if len(candles) < 5:
        return "unknown"

    recent = candles[-5:]
    closes = [item.close for item in recent]
    highs = [item.high for item in recent]
    lows = [item.low for item in recent]

    if closes[-1] > closes[0] and highs[-1] >= max(highs[:-1]) and lows[-1] >= min(lows[:-1]):
        return "bullish"

    if closes[-1] < closes[0] and lows[-1] <= min(lows[:-1]) and highs[-1] <= max(highs[:-1]):
        return "bearish"

    return "range"


def classify_entry_location(
    market_structure: str,
    close: Decimal,
    short_ema: Decimal | None,
    long_ema: Decimal | None,
    lower_band: Decimal | None,
    upper_band: Decimal | None,
    cross_state: str,
) -> str:
    if lower_band is not None and close <= lower_band:
        return "range_edge"

    if upper_band is not None and close >= upper_band:
        return "range_edge"

    nearest_average = None
    if short_ema is not None and long_ema is not None:
        nearest_average = min(abs(close - short_ema), abs(close - long_ema))
    elif short_ema is not None:
        nearest_average = abs(close - short_ema)
    elif long_ema is not None:
        nearest_average = abs(close - long_ema)

    if nearest_average is not None and nearest_average <= Decimal("0.00030"):
        return "pullback"

    if cross_state in {"bullish_cross", "bearish_cross"}:
        return "breakout"

    if market_structure == "bullish":
        return "pullback"

    if market_structure == "bearish":
        return "breakout"

    return "mid_range"


def distance_to_recent_support(candles: list[Candle]) -> Decimal | None:
    if not candles:
        return None
    current_close = candles[-1].close
    lowest = min(candle.low for candle in candles[-10:])
    return abs(current_close - lowest)


def distance_to_recent_resistance(candles: list[Candle]) -> Decimal | None:
    if not candles:
        return None
    current_close = candles[-1].close
    highest = max(candle.high for candle in candles[-10:])
    return abs(highest - current_close)


def distance_to_level(price: Decimal, level: Decimal | None) -> Decimal | None:
    if level is None:
        return None
    return abs(price - level)


def classify_atr_regime(
    candles: list[Candle],
    current_atr: Decimal | None,
    atr_period: int,
) -> str:
    if current_atr is None:
        return "unknown"

    series = average_true_range_series(candles, atr_period)
    recent_values = [item for item in series[-20:] if item is not None]

    if len(recent_values) < 5:
        return "normal"

    baseline = sum(recent_values) / Decimal(len(recent_values))

    if baseline == 0:
        return "normal"

    if current_atr < baseline * Decimal("0.85"):
        return "low"

    if current_atr > baseline * Decimal("1.15"):
        return "high"

    return "normal"


def calculate_vwap(candles: list[Candle]) -> Decimal | None:
    if not candles:
        return None

    cumulative_tp_volume = Decimal("0")
    cumulative_volume = Decimal("0")

    for candle in candles:
        volume = candle.volume if candle.volume is not None else Decimal("0")
        typical_price = (candle.high + candle.low + candle.close) / Decimal("3")
        cumulative_tp_volume += typical_price * volume
        cumulative_volume += volume

    if cumulative_volume <= 0:
        return None

    return cumulative_tp_volume / cumulative_volume


def calculate_volume_ratio(candles: list[Candle]) -> Decimal | None:
    if not candles:
        return None

    current_volume = candles[-1].volume if candles[-1].volume is not None else Decimal("0")
    baseline_source = candles[-20:-1] if len(candles) > 1 else candles[-20:]
    volumes = [candle.volume for candle in baseline_source if candle.volume is not None]

    if not volumes:
        return None

    baseline = sum(volumes) / Decimal(len(volumes))
    if baseline == 0:
        return None

    return current_volume / baseline


def calculate_volume_zscore(candles: list[Candle]) -> Decimal | None:
    if not candles:
        return None

    current_volume = candles[-1].volume if candles[-1].volume is not None else Decimal("0")
    baseline_source = candles[-20:-1] if len(candles) > 1 else candles[-20:]
    values = [candle.volume for candle in baseline_source if candle.volume is not None]

    if len(values) < 2:
        return None

    mean_value = sum(values) / Decimal(len(values))
    variance = sum((value - mean_value) ** 2 for value in values) / Decimal(len(values))
    std_dev = decimal_sqrt(variance)

    if std_dev is None or std_dev == 0:
        return None

    return (current_volume - mean_value) / std_dev


def classify_volume_signal(volume_ratio: Decimal | None) -> str:
    if volume_ratio is None:
        return "unknown"

    if volume_ratio >= Decimal("1.5"):
        return "high"

    if volume_ratio >= Decimal("1.0"):
        return "normal"

    return "low"


def classify_volume_context(volume_ratio: Decimal | None) -> str:
    if volume_ratio is None:
        return "unknown"

    if volume_ratio >= Decimal("1.5"):
        return "strong"

    if volume_ratio >= Decimal("1.0"):
        return "normal"

    return "weak"


def calculate_bollinger_z_score(
    close: Decimal,
    middle_band: Decimal | None,
    upper_band: Decimal | None,
    stddev_multiplier: Decimal,
) -> Decimal | None:
    if middle_band is None or upper_band is None or stddev_multiplier == 0:
        return None

    band_std = (upper_band - middle_band) / stddev_multiplier
    if band_std == 0:
        return None

    return (close - middle_band) / band_std


def calculate_distance_outside_band(
    close: Decimal,
    lower_band: Decimal | None,
    upper_band: Decimal | None,
    middle_band: Decimal | None,
    stddev_multiplier: Decimal,
) -> Decimal | None:
    if (
        lower_band is None
        or upper_band is None
        or middle_band is None
        or stddev_multiplier == 0
    ):
        return None

    band_std = (upper_band - middle_band) / stddev_multiplier
    if band_std == 0:
        return None

    if close > upper_band:
        return (close - upper_band) / band_std

    if close < lower_band:
        return (lower_band - close) / band_std

    return Decimal("0")


def calculate_distance_from_nearest_band(
    close: Decimal,
    lower_band: Decimal | None,
    upper_band: Decimal | None,
    middle_band: Decimal | None,
    stddev_multiplier: Decimal,
) -> Decimal | None:
    if (
        lower_band is None
        or upper_band is None
        or middle_band is None
        or stddev_multiplier == 0
    ):
        return None

    band_std = (upper_band - middle_band) / stddev_multiplier
    if band_std == 0:
        return None

    nearest_distance = min(abs(close - lower_band), abs(upper_band - close))
    return nearest_distance / band_std


def average_directional_index_series(
    candles: list[Candle],
    period: int = 14,
) -> list[Decimal | None]:
    if len(candles) < period + 1:
        return []

    trs: list[Decimal] = []
    plus_dm_values: list[Decimal] = []
    minus_dm_values: list[Decimal] = []

    for i in range(1, len(candles)):
        current = candles[i]
        previous = candles[i - 1]

        up_move = current.high - previous.high
        down_move = previous.low - current.low

        plus_dm = up_move if up_move > 0 and up_move > down_move else Decimal("0")
        minus_dm = down_move if down_move > 0 and down_move > up_move else Decimal("0")

        tr = max(
            current.high - current.low,
            abs(current.high - previous.close),
            abs(current.low - previous.close),
        )

        trs.append(tr)
        plus_dm_values.append(plus_dm)
        minus_dm_values.append(minus_dm)

    if len(trs) < period:
        return []

    smoothed_tr = sum(trs[:period])
    smoothed_plus_dm = sum(plus_dm_values[:period])
    smoothed_minus_dm = sum(minus_dm_values[:period])

    dx_values: list[Decimal] = []

    plus_di = (smoothed_plus_dm / smoothed_tr) * Decimal("100") if smoothed_tr != 0 else Decimal("0")
    minus_di = (smoothed_minus_dm / smoothed_tr) * Decimal("100") if smoothed_tr != 0 else Decimal("0")
    di_sum = plus_di + minus_di
    dx = (abs(plus_di - minus_di) / di_sum) * Decimal("100") if di_sum != 0 else Decimal("0")
    dx_values.append(dx)

    for i in range(period, len(trs)):
        smoothed_tr = smoothed_tr - (smoothed_tr / Decimal(period)) + trs[i]
        smoothed_plus_dm = smoothed_plus_dm - (smoothed_plus_dm / Decimal(period)) + plus_dm_values[i]
        smoothed_minus_dm = smoothed_minus_dm - (smoothed_minus_dm / Decimal(period)) + minus_dm_values[i]

        plus_di = (smoothed_plus_dm / smoothed_tr) * Decimal("100") if smoothed_tr != 0 else Decimal("0")
        minus_di = (smoothed_minus_dm / smoothed_tr) * Decimal("100") if smoothed_tr != 0 else Decimal("0")
        di_sum = plus_di + minus_di
        dx = (abs(plus_di - minus_di) / di_sum) * Decimal("100") if di_sum != 0 else Decimal("0")
        dx_values.append(dx)

    if len(dx_values) < period:
        return [None] * len(candles)

    adx_values: list[Decimal | None] = [None] * len(candles)

    first_adx = sum(dx_values[:period]) / Decimal(period)
    adx_index = period * 2
    if adx_index < len(adx_values):
        adx_values[adx_index] = first_adx

    previous_adx = first_adx
    for i in range(period, len(dx_values)):
        current_adx = ((previous_adx * Decimal(period - 1)) + dx_values[i]) / Decimal(period)
        target_index = i + period + 1
        if target_index < len(adx_values):
            adx_values[target_index] = current_adx
        previous_adx = current_adx

    return adx_values


def decimal_sqrt(value: Decimal) -> Decimal | None:
    if value < 0:
        return None
    if value == 0:
        return Decimal("0")

    with localcontext() as ctx:
        ctx.prec = 28
        return value.sqrt()


def quantize_decimal(value: Decimal | None, places: str = "0.00000001") -> Decimal | None:
    if value is None:
        return None
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)