import json
import math
import threading
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.settings import get_settings
from app.models.domain.candle import Candle
from app.providers.base import BaseMarketDataProvider


class ProviderQuotaExceededError(ValueError):
    pass


class ProviderTemporaryCooldownError(ValueError):
    pass


def ensure_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


class TwelveDataProvider(BaseMarketDataProvider):
    _cooldown_lock = threading.Lock()
    _cooldown_until: datetime | None = None
    _cooldown_reason: str = ""

    def __init__(self) -> None:
        self.settings = get_settings()

    def provider_name(self) -> str:
        return "twelvedata"

    def get_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        if not self.settings.twelvedata_api_key:
            raise ValueError("Twelve Data API key is not configured")

        self._raise_if_in_cooldown()

        normalized_symbol = symbol.strip().upper()
        normalized_timeframe = timeframe.strip().lower()
        normalized_start_at = ensure_naive_utc(start_at)
        normalized_end_at = ensure_naive_utc(end_at)

        interval = self._map_timeframe_to_interval(normalized_timeframe)
        outputsize = self._estimate_output_size(
            timeframe=normalized_timeframe,
            start_at=normalized_start_at,
            end_at=normalized_end_at,
        )

        params = {
            "symbol": normalized_symbol,
            "interval": interval,
            "start_date": normalized_start_at.strftime("%Y-%m-%d %H:%M:%S"),
            "end_date": normalized_end_at.strftime("%Y-%m-%d %H:%M:%S"),
            "outputsize": outputsize,
            "order": "asc",
            "format": "JSON",
        }

        url = f"{self.settings.twelvedata_base_url}/time_series?{urlencode(params)}"

        request = Request(
            url,
            headers={
                "Authorization": f"apikey {self.settings.twelvedata_api_key}",
                "Accept": "application/json",
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/136.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "close",
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            try:
                error_payload = json.loads(raw_body)
            except json.JSONDecodeError:
                error_payload = {
                    "code": exc.code,
                    "status": "error",
                    "message": raw_body or f"HTTP {exc.code}",
                }

            code = error_payload.get("code", exc.code)
            status = error_payload.get("status", "error")
            message = str(error_payload.get("message", raw_body)).strip()

            if exc.code == 429 or str(code) == "429":
                self._activate_cooldown(message)
                raise ProviderQuotaExceededError(
                    f"TwelveData error (429): {message}"
                ) from exc

            raise ValueError(
                f"Twelve Data API error ({code}, {status}): {message}"
            ) from exc
        except URLError as exc:
            raise ValueError(f"Twelve Data network error: {exc.reason}") from exc

        if payload.get("status") == "error":
            message = str(payload.get("message", "Unknown Twelve Data API error"))
            code = str(payload.get("code", "unknown"))

            if code == "429":
                self._activate_cooldown(message)
                raise ProviderQuotaExceededError(
                    f"TwelveData error (429): {message}"
                )

            raise ValueError(f"Twelve Data API error ({code}): {message}")

        values = payload.get("values", [])
        if not isinstance(values, list):
            raise ValueError("Unexpected Twelve Data response format")

        candles: list[Candle] = []
        for item in values:
            close_time = self._parse_twelvedata_datetime(item["datetime"])
            open_time = self._infer_open_time(close_time, normalized_timeframe)

            candles.append(
                Candle(
                    symbol=normalized_symbol,
                    timeframe=normalized_timeframe,
                    open_time=open_time,
                    close_time=close_time,
                    open=Decimal(item["open"]),
                    high=Decimal(item["high"]),
                    low=Decimal(item["low"]),
                    close=Decimal(item["close"]),
                    volume=Decimal(item.get("volume", "0") or "0"),
                    source=self.provider_name(),
                )
            )

        return candles

    def _raise_if_in_cooldown(self) -> None:
        with self._cooldown_lock:
            if self._cooldown_until is None:
                return

            now = datetime.utcnow()
            if now >= self._cooldown_until:
                self._cooldown_until = None
                self._cooldown_reason = ""
                return

            raise ProviderTemporaryCooldownError(
                self._cooldown_reason
                or "Twelve Data provider is temporarily in cooldown after quota exhaustion."
            )

    def _activate_cooldown(self, reason: str) -> None:
        cooldown_minutes = max(1, self.settings.provider_quota_cooldown_minutes)
        with self._cooldown_lock:
            self._cooldown_until = datetime.utcnow() + timedelta(
                minutes=cooldown_minutes
            )
            self._cooldown_reason = (
                f"TwelveData quota cooldown active for {cooldown_minutes} minutes. "
                f"Reason: {reason}"
            )

    def _estimate_output_size(
        self,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> int:
        step = self._timeframe_to_timedelta(timeframe)
        total_seconds = max(0, (end_at - start_at).total_seconds())
        bars = math.ceil(total_seconds / max(step.total_seconds(), 1))
        bars = max(1, bars + 2)

        if timeframe in {"1d", "1w", "1mo"}:
            hard_cap = max(10, self.settings.candles_bootstrap_limit_daily)
        else:
            hard_cap = max(10, self.settings.candles_gap_fill_max_bars)

        return min(bars, hard_cap)

    def _map_timeframe_to_interval(self, timeframe: str) -> str:
        mapping = {
            "1m": "1min",
            "3m": "3min",
            "5m": "5min",
            "15m": "15min",
            "30m": "30min",
            "45m": "45min",
            "1h": "1h",
            "2h": "2h",
            "4h": "4h",
            "1d": "1day",
            "1w": "1week",
            "1mo": "1month",
        }

        if timeframe not in mapping:
            raise ValueError(f"Unsupported timeframe for Twelve Data: {timeframe}")

        return mapping[timeframe]

    def _parse_twelvedata_datetime(self, value: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]

        for fmt in formats:
            try:
                parsed = datetime.strptime(value, fmt)
                return ensure_naive_utc(parsed)
            except ValueError:
                continue

        raise ValueError(f"Unsupported datetime format from Twelve Data: {value}")

    def _infer_open_time(self, close_time: datetime, timeframe: str) -> datetime:
        return close_time - self._timeframe_to_timedelta(timeframe)

    def _timeframe_to_timedelta(self, timeframe: str) -> timedelta:
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
            raise ValueError(f"Unsupported timeframe delta: {timeframe}")

        return mapping[timeframe]