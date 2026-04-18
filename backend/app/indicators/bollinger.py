from decimal import Decimal, getcontext
from math import sqrt

from app.indicators.sma import simple_moving_average


getcontext().prec = 28


def bollinger_bands(
    values: list[Decimal],
    period: int,
    stddev_multiplier: Decimal,
) -> tuple[Decimal, Decimal, Decimal] | None:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if stddev_multiplier <= 0:
        raise ValueError("stddev_multiplier must be greater than zero")

    if len(values) < period:
        return None

    window = values[-period:]
    middle = simple_moving_average(window, period)

    if middle is None:
        return None

    variance = sum((value - middle) ** 2 for value in window) / Decimal(period)
    stddev = Decimal(str(sqrt(float(variance))))

    upper = middle + (stddev * stddev_multiplier)
    lower = middle - (stddev * stddev_multiplier)

    return lower, middle, upper