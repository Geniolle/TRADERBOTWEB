from datetime import UTC, datetime, timedelta


def ensure_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def timeframe_to_timedelta(timeframe: str) -> timedelta:
    mapping = {
        "1m": timedelta(minutes=1),
        "3m": timedelta(minutes=3),
        "5m": timedelta(minutes=5),
        "15m": timedelta(minutes=15),
        "30m": timedelta(minutes=30),
        "45m": timedelta(minutes=45),
        "1h": timedelta(hours=1),
        "2h": timedelta(hours=2),
        "4h": timedelta(hours=4),
        "1d": timedelta(days=1),
        "1w": timedelta(weeks=1),
        "1mo": timedelta(days=30),
    }

    if timeframe not in mapping:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    return mapping[timeframe]


def floor_open_time(value: datetime, timeframe: str) -> datetime:
    dt = ensure_naive_utc(value)

    if timeframe == "1m":
        return dt.replace(second=0, microsecond=0)

    if timeframe == "3m":
        minute = (dt.minute // 3) * 3
        return dt.replace(minute=minute, second=0, microsecond=0)

    if timeframe == "5m":
        minute = (dt.minute // 5) * 5
        return dt.replace(minute=minute, second=0, microsecond=0)

    if timeframe == "15m":
        minute = (dt.minute // 15) * 15
        return dt.replace(minute=minute, second=0, microsecond=0)

    if timeframe == "30m":
        minute = (dt.minute // 30) * 30
        return dt.replace(minute=minute, second=0, microsecond=0)

    if timeframe == "45m":
        minute = (dt.minute // 45) * 45
        return dt.replace(minute=minute, second=0, microsecond=0)

    if timeframe == "1h":
        return dt.replace(minute=0, second=0, microsecond=0)

    if timeframe == "2h":
        hour = (dt.hour // 2) * 2
        return dt.replace(hour=hour, minute=0, second=0, microsecond=0)

    if timeframe == "4h":
        hour = (dt.hour // 4) * 4
        return dt.replace(hour=hour, minute=0, second=0, microsecond=0)

    if timeframe == "1d":
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)

    if timeframe == "1w":
        start_of_day = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day - timedelta(days=start_of_day.weekday())

    if timeframe == "1mo":
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    raise ValueError(f"Unsupported timeframe: {timeframe}")