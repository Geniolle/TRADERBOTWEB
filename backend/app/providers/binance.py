# G:\O meu disco\python\Trader-bot\app\providers\binance.py

import json
from datetime import UTC, datetime
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models.domain.candle import Candle
from app.providers.base import BaseMarketDataProvider

logger = get_logger(__name__)


class BinanceProvider(BaseMarketDataProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    def provider_name(self) -> str:
        return "binance"

    def get_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        interval = self._map_timeframe_to_interval(timeframe)
        normalized_symbol = self._normalize_symbol(symbol)

        normalized_start_at = self._assume_utc(start_at)
        normalized_end_at = self._assume_utc(end_at)

        start_ms = int(normalized_start_at.timestamp() * 1000)
        end_ms = int(normalized_end_at.timestamp() * 1000)

        params = {
            "symbol": normalized_symbol,
            "interval": interval,
            "startTime": start_ms,
            "endTime": end_ms,
            "limit": 1000,
        }

        url = f"{self.settings.binance_base_url}/api/v3/klines?{urlencode(params)}"

        logger.info("###################################################################################")
        logger.info(
            "[BINANCE] REQUEST | SYMBOL=%s | TF=%s | START_UTC=%s | END_UTC=%s | START_MS=%s | END_MS=%s",
            normalized_symbol,
            timeframe,
            normalized_start_at.isoformat(),
            normalized_end_at.isoformat(),
            start_ms,
            end_ms,
        )
        logger.info("[BINANCE] URL | %s", url)

        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Trader-Bot/1.0",
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            try:
                error_payload = json.loads(raw_body)
                message = error_payload.get("msg", raw_body)
                raise ValueError(
                    f"Binance HTTP error {exc.code}: {message}"
                ) from exc
            except json.JSONDecodeError:
                raise ValueError(
                    f"Binance HTTP error {exc.code}: {raw_body}"
                ) from exc
        except URLError as exc:
            raise ValueError(f"Binance network error: {exc.reason}") from exc

        if not isinstance(payload, list):
            raise ValueError("Unexpected Binance response format")

        logger.info(
            "[BINANCE] RESPONSE_RAW | SYMBOL=%s | TF=%s | ITEMS=%s",
            normalized_symbol,
            timeframe,
            len(payload),
        )

        candles: list[Candle] = []

        for item in payload:
            if not isinstance(item, list) or len(item) < 7:
                continue

            open_time = datetime.fromtimestamp(item[0] / 1000, tz=UTC).replace(tzinfo=None)
            close_time = datetime.fromtimestamp(item[6] / 1000, tz=UTC).replace(tzinfo=None)

            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    open_time=open_time,
                    close_time=close_time,
                    open=Decimal(str(item[1])),
                    high=Decimal(str(item[2])),
                    low=Decimal(str(item[3])),
                    close=Decimal(str(item[4])),
                    volume=Decimal(str(item[5])),
                    source=self.provider_name(),
                )
            )

        if candles:
            logger.info(
                "[BINANCE] RESPONSE_PARSED | SYMBOL=%s | TF=%s | COUNT=%s | FIRST_OPEN_UTC=%s | LAST_OPEN_UTC=%s | LAST_CLOSE_UTC=%s",
                normalized_symbol,
                timeframe,
                len(candles),
                candles[0].open_time.isoformat(),
                candles[-1].open_time.isoformat(),
                candles[-1].close_time.isoformat(),
            )
        else:
            logger.info(
                "[BINANCE] RESPONSE_PARSED | SYMBOL=%s | TF=%s | COUNT=0",
                normalized_symbol,
                timeframe,
            )

        logger.info("###################################################################################")

        return candles

    def _assume_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)

        return value.astimezone(UTC)

    def _normalize_symbol(self, symbol: str) -> str:
        return (
            symbol.replace("/", "")
            .replace("-", "")
            .replace("_", "")
            .replace(" ", "")
            .upper()
        )

    def _map_timeframe_to_interval(self, timeframe: str) -> str:
        mapping = {
            "1m": "1m",
            "3m": "3m",
            "5m": "5m",
            "15m": "15m",
            "30m": "30m",
            "1h": "1h",
            "2h": "2h",
            "4h": "4h",
            "1d": "1d",
            "1w": "1w",
            "1mo": "1M",
        }

        if timeframe not in mapping:
            raise ValueError(f"Unsupported timeframe for Binance: {timeframe}")

        return mapping[timeframe]