from app.providers.base import BaseMarketDataProvider
from app.providers.binance import BinanceProvider
from app.providers.mock import MockMarketDataProvider
from app.providers.twelvedata import TwelveDataProvider


class MarketDataProviderFactory:
    def __init__(self) -> None:
        self._providers: dict[str, type[BaseMarketDataProvider]] = {
            "binance": BinanceProvider,
            "mock": MockMarketDataProvider,
            "twelvedata": TwelveDataProvider,
        }

    def get_provider(self, provider_name: str) -> BaseMarketDataProvider:
        provider_class = self._providers.get(provider_name)

        if provider_class is None:
            raise KeyError(f"Provider not found: {provider_name}")

        return provider_class()

    def list_providers(self) -> list[str]:
        return sorted(self._providers.keys())