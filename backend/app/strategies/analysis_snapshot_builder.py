# app/strategies/analysis_snapshot_builder.py

from decimal import Decimal

from app.indicators.bollinger import bollinger_bands
from app.indicators.ema import exponential_moving_average
from app.indicators.rsi import relative_strength_index
from app.models.domain.candle import Candle


def _decimal_to_str(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return str(value)


def _classify_price_vs_ema(price: Decimal, ema_value: Decimal | None) -> str:
    if ema_value is None:
        return "Sem leitura / Sem dados"

    if price > ema_value:
        return "Acima / Preço do lado comprador"

    if price < ema_value:
        return "Abaixo / Preço do lado vendedor"

    return "Em cima / Preço exatamente na média"


def _classify_ema_alignment(
    ema_5: Decimal | None,
    ema_10: Decimal | None,
    ema_20: Decimal | None,
    ema_40: Decimal | None,
) -> str:
    if ema_5 is None or ema_10 is None or ema_20 is None or ema_40 is None:
        return "Sem leitura / Sem dados"

    if ema_5 > ema_10 > ema_20 > ema_40:
        return "Alta / Médias alinhadas para subida"

    if ema_5 < ema_10 < ema_20 < ema_40:
        return "Queda / Médias alinhadas para descida"

    return "Misto / Médias sem alinhamento limpo"


def _classify_slope(current_value: Decimal | None, previous_value: Decimal | None) -> str:
    if current_value is None or previous_value is None:
        return "Sem leitura / Sem dados"

    if current_value > previous_value:
        return "A subir / Tendência a ganhar força"

    if current_value < previous_value:
        return "A descer / Tendência a perder força ou cair"

    return "Lateral / Sem inclinação relevante"


def _classify_structure(
    ema_alignment: str,
    price_vs_ema_20: str,
    price_vs_ema_40: str,
) -> str:
    if "Sem leitura" in ema_alignment:
        return "Sem leitura / Sem dados"

    if ema_alignment.startswith("Alta") and "Acima" in price_vs_ema_20 and "Acima" in price_vs_ema_40:
        return "Alta / Estrutura favorável para subida"

    if ema_alignment.startswith("Queda") and "Abaixo" in price_vs_ema_20 and "Abaixo" in price_vs_ema_40:
        return "Baixa / Estrutura favorável para descida"

    return "Lateral / Mercado sem direção clara"


def _classify_rsi_zone(rsi_value: Decimal | None) -> str:
    if rsi_value is None:
        return "Sem dados"

    if rsi_value <= Decimal("30"):
        return "Sobrevendido"

    if rsi_value >= Decimal("70"):
        return "Sobrecomprado"

    if Decimal("45") <= rsi_value <= Decimal("55"):
        return "Neutro"

    if rsi_value < Decimal("45"):
        return "Fraqueza"

    return "Alta"


def _classify_macd_proxy(candles: list[Candle]) -> str:
    closes = [candle.close for candle in candles]
    ema_12 = exponential_moving_average(closes, 12)
    ema_26 = exponential_moving_average(closes, 26)

    if ema_12 is None or ema_26 is None:
        return "Sem leitura / Sem dados"

    if ema_12 > ema_26:
        return "Alta / Pressão compradora"

    if ema_12 < ema_26:
        return "Queda / Pressão vendedora"

    return "Neutro / Sem vantagem clara"


def _body_ratio(candle: Candle) -> Decimal:
    candle_range = candle.high - candle.low
    if candle_range <= Decimal("0"):
        return Decimal("0")

    body = abs(candle.close - candle.open)
    return body / candle_range


def _classify_candle_type(candle: Candle) -> str:
    ratio = _body_ratio(candle)

    if ratio >= Decimal("0.65"):
        return "Bom / Candle com corpo firme"

    if ratio >= Decimal("0.45"):
        return "Saudável / Candle com tamanho normal"

    return "Normal / Candle sem destaque forte"


def _distance_label(price: Decimal, level: Decimal | None) -> str:
    if level is None:
        return "Sem leitura / Sem dados"

    distance = abs(price - level)

    if distance <= Decimal("0.0003"):
        return "Muito perto / Pouco espaço até ao nível"

    if distance <= Decimal("0.0008"):
        return "Perto / Espaço moderado"

    return "Longe / Espaço confortável"


def build_analysis_snapshot(
    candles: list[Candle],
    index: int,
    direction: str,
    setup_type: str,
) -> dict:
    current_candle = candles[index]
    previous_candle = candles[index - 1] if index > 0 else current_candle

    current_slice = candles[: index + 1]
    previous_slice = candles[:index] if index > 0 else candles[: index + 1]

    closes_current = [candle.close for candle in current_slice]
    closes_previous = [candle.close for candle in previous_slice]

    ema_5 = exponential_moving_average(closes_current, 5)
    ema_10 = exponential_moving_average(closes_current, 10)
    ema_20 = exponential_moving_average(closes_current, 20)
    ema_40 = exponential_moving_average(closes_current, 40)

    prev_ema_5 = exponential_moving_average(closes_previous, 5)
    prev_ema_10 = exponential_moving_average(closes_previous, 10)
    prev_ema_20 = exponential_moving_average(closes_previous, 20)
    prev_ema_40 = exponential_moving_average(closes_previous, 40)

    rsi_14 = relative_strength_index(closes_current, 14)

    bollinger = bollinger_bands(
        values=closes_current,
        period=20,
        stddev_multiplier=Decimal("2"),
    )

    lower_band: Decimal | None = None
    middle_band: Decimal | None = None
    upper_band: Decimal | None = None

    if bollinger is not None:
        lower_band, middle_band, upper_band = bollinger

    price_vs_ema_20 = _classify_price_vs_ema(current_candle.close, ema_20)
    price_vs_ema_40 = _classify_price_vs_ema(current_candle.close, ema_40)
    ema_alignment = _classify_ema_alignment(ema_5, ema_10, ema_20, ema_40)

    market_structure = _classify_structure(
        ema_alignment=ema_alignment,
        price_vs_ema_20=price_vs_ema_20,
        price_vs_ema_40=price_vs_ema_40,
    )

    candle_type = _classify_candle_type(current_candle)

    body_ratio = _body_ratio(current_candle)
    upper_wick = current_candle.high - max(current_candle.open, current_candle.close)
    lower_wick = min(current_candle.open, current_candle.close) - current_candle.low

    previous_closed_above_upper = upper_band is not None and previous_candle.close > upper_band
    previous_closed_below_lower = lower_band is not None and previous_candle.close < lower_band
    current_closed_back_inside_from_above = upper_band is not None and current_candle.close < upper_band
    current_closed_back_inside_from_below = lower_band is not None and current_candle.close > lower_band

    bb_reentry_long = previous_closed_below_lower and current_closed_back_inside_from_below
    bb_reentry_short = previous_closed_above_upper and current_closed_back_inside_from_above
    bb_walk_long = upper_band is not None and current_candle.close >= upper_band
    bb_walk_short = lower_band is not None and current_candle.close <= lower_band

    snapshot = {
        "trigger_context": {
            "session": "Sem leitura / Sem dados",
            "day_of_week": current_candle.close_time.strftime("%A"),
            "hour_of_day": current_candle.close_time.strftime("%H:%M"),
        },
        "trend": {
            "ema_alignment": ema_alignment,
            "price_vs_ema_20": price_vs_ema_20,
            "price_vs_ema_40": price_vs_ema_40,
            "ema_5_slope": _classify_slope(ema_5, prev_ema_5),
            "ema_10_slope": _classify_slope(ema_10, prev_ema_10),
            "ema_20_slope": _classify_slope(ema_20, prev_ema_20),
            "ema_30_slope": "Sem leitura / Sem dados",
            "ema_40_slope": _classify_slope(ema_40, prev_ema_40),
        },
        "momentum": {
            "rsi_14": _decimal_to_str(rsi_14),
            "rsi_zone": _classify_rsi_zone(rsi_14),
            "rsi_slope": "Sem leitura / Sem dados",
            "macd_state": _classify_macd_proxy(current_slice),
            "macd_histogram_slope": "Sem leitura / Sem dados",
        },
        "bollinger": {
            "upper": _decimal_to_str(upper_band),
            "middle": _decimal_to_str(middle_band),
            "lower": _decimal_to_str(lower_band),
            "bandwidth": _decimal_to_str(upper_band - lower_band) if upper_band is not None and lower_band is not None else None,
        },
        "structure": {
            "market_structure": market_structure,
            "entry_location": "Reentrada à média após excesso" if setup_type == "bb_reentry" else "Continuação na banda",
            "distance_to_recent_support": _distance_label(current_candle.close, lower_band),
            "distance_to_recent_resistance": _distance_label(current_candle.close, upper_band),
        },
        "trigger_candle": {
            "candle_type": candle_type,
            "body_ratio": str(body_ratio),
            "upper_wick": str(upper_wick),
            "lower_wick": str(lower_wick),
        },
        "patterns": {
            "bb_reentry_long": bb_reentry_long,
            "bb_reentry_short": bb_reentry_short,
            "bb_walk_long": bb_walk_long,
            "bb_walk_short": bb_walk_short,
            "ema_trend_confirmed_long": ema_alignment.startswith("Alta"),
            "ema_trend_confirmed_short": ema_alignment.startswith("Queda"),
            "rsi_recovery_long": rsi_14 is not None and rsi_14 > Decimal("30"),
            "macd_confirmation_long": _classify_macd_proxy(current_slice).startswith("Alta"),
            "countertrend_long": direction == "long" and ema_alignment.startswith("Queda"),
            "countertrend_short": direction == "short" and ema_alignment.startswith("Alta"),
        },
        "extra": {
            "setup_type": setup_type,
            "direction": direction,
            "previous_close": str(previous_candle.close),
            "current_close": str(current_candle.close),
            "middle_band": _decimal_to_str(middle_band),
            "support_distance_label": _distance_label(current_candle.close, lower_band),
            "resistance_distance_label": _distance_label(current_candle.close, upper_band),
        },
    }

    return snapshot
