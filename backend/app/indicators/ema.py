# app/indicators/ema.py

from decimal import Decimal


def exponential_moving_average(values: list[Decimal], period: int) -> Decimal | None:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if len(values) < period:
        return None

    multiplier = Decimal("2") / Decimal(period + 1)
    ema = sum(values[:period]) / Decimal(period)

    for value in values[period:]:
        ema = (value - ema) * multiplier + ema

    return ema


def exponential_moving_average_series(
    values: list[Decimal],
    period: int,
) -> list[Decimal | None]:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if not values:
        return []

    result: list[Decimal | None] = [None] * len(values)

    if len(values) < period:
        return result

    multiplier = Decimal("2") / Decimal(period + 1)
    ema = sum(values[:period]) / Decimal(period)
    result[period - 1] = ema

    for index in range(period, len(values)):
        ema = (values[index] - ema) * multiplier + ema
        result[index] = ema

    return result