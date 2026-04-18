# app/indicators/rsi.py

from decimal import Decimal


def relative_strength_index(values: list[Decimal], period: int) -> Decimal | None:
    series = relative_strength_index_series(values, period)
    if not series:
        return None
    return series[-1]


def relative_strength_index_series(
    values: list[Decimal],
    period: int,
) -> list[Decimal | None]:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if not values:
        return []

    result: list[Decimal | None] = [None] * len(values)

    if len(values) < period + 1:
        return result

    gains: list[Decimal] = []
    losses: list[Decimal] = []

    for index in range(1, len(values)):
        change = values[index] - values[index - 1]
        gains.append(change if change > 0 else Decimal("0"))
        losses.append(-change if change < 0 else Decimal("0"))

    avg_gain = sum(gains[:period]) / Decimal(period)
    avg_loss = sum(losses[:period]) / Decimal(period)

    result[period] = _build_rsi(avg_gain, avg_loss)

    for gain_index in range(period, len(gains)):
        avg_gain = ((avg_gain * Decimal(period - 1)) + gains[gain_index]) / Decimal(period)
        avg_loss = ((avg_loss * Decimal(period - 1)) + losses[gain_index]) / Decimal(period)
        result[gain_index + 1] = _build_rsi(avg_gain, avg_loss)

    return result


def _build_rsi(avg_gain: Decimal, avg_loss: Decimal) -> Decimal:
    if avg_loss == 0:
        return Decimal("100")

    rs = avg_gain / avg_loss
    return Decimal("100") - (Decimal("100") / (Decimal("1") + rs))