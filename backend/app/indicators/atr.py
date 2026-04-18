# app/indicators/atr.py

from decimal import Decimal

from app.models.domain.candle import Candle


def average_true_range(candles: list[Candle], period: int) -> Decimal | None:
    series = average_true_range_series(candles, period)
    if not series:
        return None
    return series[-1]


def average_true_range_series(
    candles: list[Candle],
    period: int,
) -> list[Decimal | None]:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if not candles:
        return []

    result: list[Decimal | None] = [None] * len(candles)

    if len(candles) < period + 1:
        return result

    true_ranges: list[Decimal] = []

    for index, candle in enumerate(candles):
        if index == 0:
            true_range = candle.high - candle.low
        else:
            previous_close = candles[index - 1].close
            high_low = candle.high - candle.low
            high_close = abs(candle.high - previous_close)
            low_close = abs(candle.low - previous_close)
            true_range = max(high_low, high_close, low_close)

        true_ranges.append(true_range)

    initial_window = true_ranges[1 : period + 1]
    atr = sum(initial_window) / Decimal(period)
    result[period] = atr

    for index in range(period + 1, len(candles)):
        atr = ((atr * Decimal(period - 1)) + true_ranges[index]) / Decimal(period)
        result[index] = atr

    return result