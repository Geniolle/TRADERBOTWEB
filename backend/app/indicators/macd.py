# app/indicators/macd.py

from decimal import Decimal

from app.indicators.ema import exponential_moving_average_series


def macd(
    values: list[Decimal],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict[str, Decimal] | None:
    series = macd_series(
        values=values,
        fast_period=fast_period,
        slow_period=slow_period,
        signal_period=signal_period,
    )

    if not series:
        return None

    last = series[-1]
    if (
        last["macd_line"] is None
        or last["signal_line"] is None
        or last["histogram"] is None
    ):
        return None

    return {
        "macd_line": last["macd_line"],
        "signal_line": last["signal_line"],
        "histogram": last["histogram"],
    }


def macd_series(
    values: list[Decimal],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> list[dict[str, Decimal | None]]:
    if fast_period <= 0 or slow_period <= 0 or signal_period <= 0:
        raise ValueError("all periods must be greater than zero")

    if fast_period >= slow_period:
        raise ValueError("fast_period must be less than slow_period")

    if not values:
        return []

    fast_ema = exponential_moving_average_series(values, fast_period)
    slow_ema = exponential_moving_average_series(values, slow_period)

    macd_line_series: list[Decimal | None] = [None] * len(values)

    for index in range(len(values)):
        fast_value = fast_ema[index]
        slow_value = slow_ema[index]

        if fast_value is None or slow_value is None:
            continue

        macd_line_series[index] = fast_value - slow_value

    compact_macd_values = [item for item in macd_line_series if item is not None]
    signal_compact = exponential_moving_average_series(compact_macd_values, signal_period)

    result: list[dict[str, Decimal | None]] = []
    compact_index = 0

    for index in range(len(values)):
        macd_line = macd_line_series[index]

        if macd_line is None:
            result.append(
                {
                    "macd_line": None,
                    "signal_line": None,
                    "histogram": None,
                }
            )
            continue

        signal_line = signal_compact[compact_index]
        compact_index += 1

        histogram = None
        if signal_line is not None:
            histogram = macd_line - signal_line

        result.append(
            {
                "macd_line": macd_line,
                "signal_line": signal_line,
                "histogram": histogram,
            }
        )

    return result