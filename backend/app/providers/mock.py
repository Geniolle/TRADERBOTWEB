# app/providers/mock.py

from datetime import datetime, timedelta
from decimal import Decimal

from app.models.domain.candle import Candle
from app.providers.base import BaseMarketDataProvider


class MockMarketDataProvider(BaseMarketDataProvider):
    def provider_name(self) -> str:
        return "mock"

    def get_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        timeframe_to_minutes = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "1h": 60,
        }

        if timeframe not in timeframe_to_minutes:
            raise ValueError(f"Unsupported timeframe for mock generation: {timeframe}")

        step_minutes = timeframe_to_minutes[timeframe]
        current_open = start_at

        closes = [
            Decimal("100"),
            Decimal("101"),
            Decimal("102"),
            Decimal("103"),
            Decimal("104"),
            Decimal("106"),
            Decimal("103"),
            Decimal("102"),
            Decimal("101"),
            Decimal("100"),
        ]

        candles: list[Candle] = []

        for close in closes:
            close_time = current_open + timedelta(minutes=step_minutes)

            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    open_time=current_open,
                    close_time=close_time,
                    open=close,
                    high=close + Decimal("1"),
                    low=close - Decimal("1"),
                    close=close,
                    volume=Decimal("1000"),
                    source=self.provider_name(),
                )
            )

            current_open = close_time

            if current_open >= end_at:
                break

        return candles