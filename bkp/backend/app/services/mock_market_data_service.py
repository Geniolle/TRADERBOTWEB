from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException

from app.models.domain.candle import Candle
from app.schemas.run import HistoricalRunRequest


class MockMarketDataService:
    def build_historical_candles(self, request: HistoricalRunRequest) -> list[Candle]:
        timeframe_to_minutes = {
            "1m": 1,
            "5m": 5,
            "15m": 15,
            "1h": 60,
        }

        if request.timeframe not in timeframe_to_minutes:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported timeframe for mock generation: {request.timeframe}",
            )

        step_minutes = timeframe_to_minutes[request.timeframe]
        current_open = request.start_at

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
                    symbol=request.symbol,
                    timeframe=request.timeframe,
                    open_time=current_open,
                    close_time=close_time,
                    open=close,
                    high=close + Decimal("1"),
                    low=close - Decimal("1"),
                    close=close,
                    volume=Decimal("1000"),
                    source="mock",
                )
            )

            current_open = close_time

            if current_open >= request.end_at:
                break

        return candles