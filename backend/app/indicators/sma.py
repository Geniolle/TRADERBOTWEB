from decimal import Decimal


def simple_moving_average(values: list[Decimal], period: int) -> Decimal | None:
    if period <= 0:
        raise ValueError("period must be greater than zero")

    if len(values) < period:
        return None

    window = values[-period:]
    return sum(window) / Decimal(period)