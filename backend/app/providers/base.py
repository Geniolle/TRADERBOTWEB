# app/providers/base.py

from abc import ABC, abstractmethod
from datetime import datetime

from app.models.domain.candle import Candle


class BaseMarketDataProvider(ABC):
    @abstractmethod
    def provider_name(self) -> str:
        """
        Return the provider identifier/name.
        """
        raise NotImplementedError

    @abstractmethod
    def get_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        """
        Fetch historical candles already normalized to the internal Candle model.
        """
        raise NotImplementedError